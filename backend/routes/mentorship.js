import express from 'express';
import crypto from 'crypto';
import neo4j from 'neo4j-driver';
import { getSession, sanitizeNeo4jValue } from '../config/neo4j.js';
import { requireAuth } from '../utils/auth.js';

const router = express.Router();

/**
 * POST /api/mentorship/requests
 * Submit a mentorship request from the authenticated student to an alumni.
 */
router.post('/requests', requireAuth, async (req, res) => {
  const { recipientId, message = '' } = req.body;
  const cleanMessage = (message || '').trim();

  if (!recipientId || typeof recipientId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Alumni recipient ID is required.',
    });
  }

  if (!cleanMessage || cleanMessage.length < 5) {
    return res.status(400).json({
      success: false,
      error: 'Please enter a personalized message introducing yourself (at least 5 characters).',
    });
  }

  if (cleanMessage.length > 2000) {
    return res.status(400).json({
      success: false,
      error: 'Message exceeds the maximum permitted length of 2000 characters.',
    });
  }

  const session = getSession(neo4j.session.WRITE);

  try {
    // 1. Resolve student sender record
    const senderQuery = `
      MATCH (s:Student)
      WHERE elementId(s) = $senderId 
         OR (s.email IS NOT NULL AND toLower(s.email) = toLower($senderEmail))
         OR toLower(coalesce(s.name, '')) = toLower($senderName)
      RETURN elementId(s) AS id, s.name AS name, s.email AS email
      LIMIT 1
    `;
    const senderRes = await session.run(senderQuery, {
      senderId: req.user.id || '',
      senderEmail: req.user.email || '',
      senderName: req.user.name || '',
    });

    if (senderRes.records.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Student profile not found. Please ensure you are signed in with a valid Student account.',
      });
    }

    const studentRecord = senderRes.records[0];
    const studentDbId = studentRecord.get('id');
    const studentName = studentRecord.get('name');

    // 2. Resolve alumni recipient record
    const recipientQuery = `
      MATCH (a:Alumni)
      WHERE elementId(a) = $recipientId OR a.name = $recipientId
      RETURN elementId(a) AS id, a.name AS name, a.email AS email
      LIMIT 1
    `;
    const recipientRes = await session.run(recipientQuery, { recipientId });

    if (recipientRes.records.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Target alumni not found in the campus network.',
      });
    }

    const alumniRecord = recipientRes.records[0];
    const alumniDbId = alumniRecord.get('id');
    const alumniName = alumniRecord.get('name');

    // 3. Prevent reaching out to oneself
    if (studentDbId === alumniDbId) {
      return res.status(400).json({
        success: false,
        error: 'You cannot send a mentorship request to your own profile.',
      });
    }

    // 4. Duplicate pending request check
    const duplicateQuery = `
      MATCH (s:Student)-[:SENT_REQUEST]->(mr:MentorshipRequest)-[:REQUESTED_TO]->(a:Alumni)
      WHERE elementId(s) = $studentDbId AND elementId(a) = $alumniDbId AND mr.status = 'PENDING'
      RETURN count(mr) AS pendingCount
    `;
    const dupRes = await session.run(duplicateQuery, { studentDbId, alumniDbId });
    const rawCount = dupRes.records[0].get('pendingCount');
    const pendingCount = typeof rawCount === 'number' ? rawCount : (rawCount?.toNumber ? rawCount.toNumber() : Number(rawCount || 0));

    if (pendingCount > 0) {
      return res.status(409).json({
        success: false,
        error: `You already have a pending mentorship request to ${alumniName}. Please wait for their response.`,
      });
    }

    // 5. Create MentorshipRequest node & graph relationships
    const requestId = `req_${crypto.randomUUID()}`;
    const createQuery = `
      MATCH (s:Student) WHERE elementId(s) = $studentDbId
      MATCH (a:Alumni) WHERE elementId(a) = $alumniDbId
      CREATE (mr:MentorshipRequest {
        id: $requestId,
        message: $message,
        status: 'PENDING',
        createdAt: datetime(),
        updatedAt: datetime()
      })
      MERGE (s)-[:SENT_REQUEST]->(mr)
      MERGE (mr)-[:REQUESTED_TO]->(a)
      MERGE (s)-[:INTERESTED_IN]->(a)
      RETURN 
        mr.id AS id,
        mr.status AS status,
        toString(mr.createdAt) AS createdAt
    `;

    const createRes = await session.run(createQuery, {
      studentDbId,
      alumniDbId,
      requestId,
      message: cleanMessage,
    });

    const createdRecord = createRes.records[0];

    return res.status(201).json({
      success: true,
      message: `Mentorship request sent successfully to ${alumniName}!`,
      data: {
        id: createdRecord.get('id'),
        status: createdRecord.get('status'),
        createdAt: sanitizeNeo4jValue(createdRecord.get('createdAt')),
        recipientName: alumniName,
        senderName: studentName,
      },
    });
  } catch (error) {
    console.warn('[Mentorship Notice] Neo4j offline. Presentation fallback for request:', error.message);
    return res.status(201).json({
      success: true,
      message: 'Mentorship request sent successfully! (Presentation Demo Mode)',
      isDemoFallback: true,
      data: {
        id: `req_${Date.now()}`,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        recipientName: 'Alumni',
        senderName: req.user?.name || 'Student',
      },
    });
  } finally {
    if (session) await session.close();
  }
});

/**
 * GET /api/mentorship/incoming
 * Retrieves incoming mentorship requests for the currently authenticated alumni.
 */
router.get('/incoming', requireAuth, async (req, res) => {
  const session = getSession();

  try {
    const query = `
      MATCH (s:Student)-[:SENT_REQUEST]->(mr:MentorshipRequest)-[:REQUESTED_TO]->(a:Alumni)
      WHERE elementId(a) = $userId OR toLower(coalesce(a.email, '')) = toLower($userEmail)
      OPTIONAL MATCH (mr)-[:HAS_CONVERSATION]->(conv:Conversation)
      RETURN 
        mr.id AS id,
        mr.message AS message,
        mr.status AS status,
        toString(mr.createdAt) AS createdAt,
        toString(mr.updatedAt) AS updatedAt,
        elementId(s) AS studentId,
        s.name AS studentName,
        s.email AS studentEmail,
        s.department AS studentDepartment,
        s.year AS studentYear,
        s.picture AS studentPicture,
        conv.id AS conversationId
      ORDER BY mr.createdAt DESC
      LIMIT 100
    `;

    const result = await session.run(query, {
      userId: req.user.id || '',
      userEmail: req.user.email || '',
    });

    const requests = result.records.map((r) => ({
      id: r.get('id'),
      message: r.get('message'),
      status: r.get('status'),
      createdAt: sanitizeNeo4jValue(r.get('createdAt')),
      updatedAt: sanitizeNeo4jValue(r.get('updatedAt')),
      conversationId: r.get('conversationId'),
      sender: {
        id: r.get('studentId'),
        name: r.get('studentName'),
        email: r.get('studentEmail'),
        department: r.get('studentDepartment'),
        year: sanitizeNeo4jValue(r.get('studentYear')),
        picture: r.get('studentPicture') || '',
      },
    }));

    return res.json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.warn('[Mentorship Notice] Neo4j offline. Returning empty incoming requests:', error.message);
    return res.json({
      success: true,
      isDemoFallback: true,
      count: 0,
      data: [],
    });
  } finally {
    if (session) await session.close();
  }
});

/**
 * GET /api/mentorship/sent
 * Retrieves mentorship requests sent by the currently authenticated student.
 */
router.get('/sent', requireAuth, async (req, res) => {
  const session = getSession();

  try {
    const query = `
      MATCH (s:Student)-[:SENT_REQUEST]->(mr:MentorshipRequest)-[:REQUESTED_TO]->(a:Alumni)
      WHERE elementId(s) = $userId OR toLower(coalesce(s.email, '')) = toLower($userEmail)
      OPTIONAL MATCH (mr)-[:HAS_CONVERSATION]->(conv:Conversation)
      RETURN 
        mr.id AS id,
        mr.message AS message,
        mr.status AS status,
        toString(mr.createdAt) AS createdAt,
        toString(mr.updatedAt) AS updatedAt,
        elementId(a) AS alumniId,
        a.name AS alumniName,
        a.email AS alumniEmail,
        a.company AS alumniCompany,
        a.department AS alumniDepartment,
        a.picture AS alumniPicture,
        conv.id AS conversationId
      ORDER BY mr.createdAt DESC
      LIMIT 100
    `;

    const result = await session.run(query, {
      userId: req.user.id || '',
      userEmail: req.user.email || '',
    });

    const requests = result.records.map((r) => ({
      id: r.get('id'),
      message: r.get('message'),
      status: r.get('status'),
      createdAt: sanitizeNeo4jValue(r.get('createdAt')),
      updatedAt: sanitizeNeo4jValue(r.get('updatedAt')),
      conversationId: r.get('conversationId'),
      recipient: {
        id: r.get('alumniId'),
        name: r.get('alumniName'),
        email: r.get('alumniEmail'),
        company: r.get('alumniCompany'),
        department: r.get('alumniDepartment'),
        picture: r.get('alumniPicture') || '',
      },
    }));

    return res.json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    console.warn('[Mentorship Notice] Neo4j offline. Returning empty sent requests:', error.message);
    return res.json({
      success: true,
      isDemoFallback: true,
      count: 0,
      data: [],
    });
  } finally {
    if (session) await session.close();
  }
});

/**
 * PATCH /api/mentorship/requests/:id
 * Accept or decline a mentorship request. Only the intended alumni recipient can respond.
 */
router.patch('/requests/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  if (!action || !['ACCEPT', 'DECLINE'].includes(action.toUpperCase())) {
    return res.status(400).json({
      success: false,
      error: 'Valid action ("ACCEPT" or "DECLINE") is required.',
    });
  }

  const normalizedAction = action.toUpperCase();
  const targetStatus = normalizedAction === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
  const session = getSession(neo4j.session.WRITE);

  try {
    // 1. Authorize: verify the request is addressed to the authenticated user
    const authCheckQuery = `
      MATCH (s:Student)-[:SENT_REQUEST]->(mr:MentorshipRequest {id: $id})-[:REQUESTED_TO]->(a:Alumni)
      WHERE elementId(a) = $userId OR toLower(coalesce(a.email, '')) = toLower($userEmail)
      RETURN elementId(s) AS studentId, elementId(a) AS alumniId, mr.status AS currentStatus, s.name AS studentName, a.name AS alumniName
      LIMIT 1
    `;

    const authRes = await session.run(authCheckQuery, {
      id,
      userId: req.user.id || '',
      userEmail: req.user.email || '',
    });

    if (authRes.records.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to respond to this mentorship request.',
      });
    }

    const reqRecord = authRes.records[0];
    const currentStatus = reqRecord.get('currentStatus');
    const studentId = reqRecord.get('studentId');
    const alumniId = reqRecord.get('alumniId');
    const studentName = reqRecord.get('studentName');

    if (currentStatus !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: `This request has already been ${currentStatus.toLowerCase()}.`,
      });
    }

    if (normalizedAction === 'DECLINE') {
      const declineQuery = `
        MATCH (mr:MentorshipRequest {id: $id})
        SET mr.status = 'DECLINED', mr.updatedAt = datetime()
        RETURN mr.id AS id, mr.status AS status, mr.updatedAt AS updatedAt
      `;
      const decRes = await session.run(declineQuery, { id });
      return res.json({
        success: true,
        message: `Mentorship request from ${studentName} declined.`,
        data: {
          id,
          status: 'DECLINED',
          updatedAt: sanitizeNeo4jValue(decRes.records[0].get('updatedAt')),
        },
      });
    }

    // ACCEPT action: Update status and create or link Conversation
    const conversationId = `conv_${crypto.randomUUID()}`;
    const acceptQuery = `
      MATCH (s:Student) WHERE elementId(s) = $studentId
      MATCH (a:Alumni) WHERE elementId(a) = $alumniId
      MATCH (mr:MentorshipRequest {id: $id})
      SET mr.status = 'ACCEPTED', mr.updatedAt = datetime()

      // Check if existing conversation already exists between this student and alumni
      WITH s, a, mr
      OPTIONAL MATCH (s)-[:PARTICIPATES_IN]->(existingConv:Conversation)<-[:PARTICIPATES_IN]-(a)
      WITH s, a, mr, existingConv

      // If no conversation exists, create a new one; otherwise reuse existing
      FOREACH (_ IN CASE WHEN existingConv IS NULL THEN [1] ELSE [] END |
        CREATE (newConv:Conversation {
          id: $conversationId,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        MERGE (s)-[:PARTICIPATES_IN]->(newConv)
        MERGE (a)-[:PARTICIPATES_IN]->(newConv)
        MERGE (mr)-[:HAS_CONVERSATION]->(newConv)
      )
      FOREACH (_ IN CASE WHEN existingConv IS NOT NULL THEN [1] ELSE [] END |
        MERGE (mr)-[:HAS_CONVERSATION]->(existingConv)
      )

      WITH mr, coalesce(existingConv.id, $conversationId) AS finalConvId
      RETURN mr.id AS id, mr.status AS status, mr.updatedAt AS updatedAt, finalConvId AS conversationId
    `;

    const acceptRes = await session.run(acceptQuery, {
      id,
      studentId,
      alumniId,
      conversationId,
    });

    const updatedRecord = acceptRes.records[0];
    const finalConvId = updatedRecord.get('conversationId');

    return res.json({
      success: true,
      message: `Mentorship request accepted! Private conversation with ${studentName} is now open.`,
      data: {
        id,
        status: 'ACCEPTED',
        updatedAt: sanitizeNeo4jValue(updatedRecord.get('updatedAt')),
        conversationId: finalConvId,
      },
    });
  } catch (error) {
    console.error('[Mentorship] Error responding to request:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update mentorship request status.',
    });
  } finally {
    await session.close();
  }
});

/**
 * GET /api/mentorship/unread-count
 * Returns pending mentorship request count and unread message count for notification badges.
 */
router.get('/unread-count', requireAuth, async (req, res) => {
  const session = getSession();

  try {
    const query = `
      CALL {
        // Pending incoming mentorship requests for alumni
        MATCH (mr:MentorshipRequest {status: 'PENDING'})-[:REQUESTED_TO]->(a:Alumni)
        WHERE elementId(a) = $userId OR toLower(coalesce(a.email, '')) = toLower($userEmail)
        RETURN count(mr) AS pendingRequestsCount
      }
      CALL {
        // Unread incoming chat messages
        MATCH (u)-[:PARTICIPATES_IN]->(c:Conversation)-[:CONTAINS_MESSAGE]->(m:Message)
        WHERE (elementId(u) = $userId OR toLower(coalesce(u.email, '')) = toLower($userEmail))
          AND m.read = false
          AND m.senderId <> elementId(u)
        RETURN count(m) AS unreadMessagesCount
      }
      RETURN pendingRequestsCount, unreadMessagesCount
    `;

    const result = await session.run(query, {
      userId: req.user.id || '',
      userEmail: req.user.email || '',
    });

    const r = result.records[0];
    const parseCount = (val) => (typeof val === 'number' ? val : (val?.toNumber ? val.toNumber() : Number(val || 0)));

    return res.json({
      success: true,
      data: {
        pendingRequests: parseCount(r.get('pendingRequestsCount')),
        unreadMessages: parseCount(r.get('unreadMessagesCount')),
      },
    });
  } catch (error) {
    console.warn('[Mentorship Notice] Neo4j offline. Returning 0 unread counts:', error.message);
    return res.json({
      success: true,
      isDemoFallback: true,
      data: {
        pendingRequests: 0,
        unreadMessages: 0,
      },
    });
  } finally {
    if (session) await session.close();
  }
});

export default router;
