import express from 'express';
import crypto from 'crypto';
import neo4j from 'neo4j-driver';
import { getSession, sanitizeNeo4jValue } from '../config/neo4j.js';
import { requireAuth } from '../utils/auth.js';

const router = express.Router();

/**
 * GET /api/chat/conversations
 * List all active conversations for the authenticated user (student or alumni).
 */
router.get('/conversations', requireAuth, async (req, res) => {
  const session = getSession();

  try {
    const query = `
      MATCH (u)-[:PARTICIPATES_IN]->(c:Conversation)<-[:PARTICIPATES_IN]-(partner)
      WHERE elementId(u) = $userId OR toLower(coalesce(u.email, '')) = toLower($userEmail)
      OPTIONAL MATCH (c)-[:CONTAINS_MESSAGE]->(m:Message)
      WITH c, partner, m, u
      ORDER BY m.createdAt DESC
      WITH c, partner, u, collect(m)[0] AS lastMsg,
           count(CASE WHEN m.read = false AND m.senderId <> elementId(u) THEN 1 END) AS unreadCount
      RETURN 
        c.id AS id,
        toString(c.createdAt) AS createdAt,
        toString(c.updatedAt) AS updatedAt,
        elementId(partner) AS partnerId,
        partner.name AS partnerName,
        partner.email AS partnerEmail,
        labels(partner)[0] AS partnerRole,
        partner.department AS partnerDepartment,
        partner.company AS partnerCompany,
        partner.picture AS partnerPicture,
        lastMsg.text AS lastMessageText,
        toString(lastMsg.createdAt) AS lastMessageAt,
        lastMsg.senderName AS lastMessageSender,
        unreadCount
      ORDER BY coalesce(lastMsg.createdAt, c.updatedAt, c.createdAt) DESC
      LIMIT 50
    `;

    const result = await session.run(query, {
      userId: req.user.id || '',
      userEmail: req.user.email || '',
    });

    const parseCount = (val) => (typeof val === 'number' ? val : (val?.toNumber ? val.toNumber() : Number(val || 0)));

    const conversations = result.records.map((r) => ({
      id: r.get('id'),
      createdAt: sanitizeNeo4jValue(r.get('createdAt')),
      updatedAt: sanitizeNeo4jValue(r.get('updatedAt')),
      partner: {
        id: r.get('partnerId'),
        name: r.get('partnerName'),
        email: r.get('partnerEmail'),
        role: r.get('partnerRole'),
        department: r.get('partnerDepartment') || 'CSE',
        company: r.get('partnerCompany') || '',
        picture: r.get('partnerPicture') || '',
      },
      lastMessage: r.get('lastMessageText')
        ? {
            text: r.get('lastMessageText'),
            createdAt: sanitizeNeo4jValue(r.get('lastMessageAt')),
            senderName: r.get('lastMessageSender'),
          }
        : null,
      unreadCount: parseCount(r.get('unreadCount')),
    }));

    return res.json({
      success: true,
      count: conversations.length,
      data: conversations,
    });
  } catch (error) {
    console.error('[Chat] Error fetching conversations:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversations from database.',
    });
  } finally {
    await session.close();
  }
});

/**
 * GET /api/chat/conversations/:id/messages
 * Retrieve chronological messages for a conversation.
 * Authorizes that req.user is a verified participant. Marks incoming messages as read.
 */
router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  const { id } = req.params;
  const session = getSession(neo4j.session.WRITE);

  try {
    // 1. Authorize: verify participation
    const authQuery = `
      MATCH (u)-[:PARTICIPATES_IN]->(c:Conversation {id: $id})
      WHERE elementId(u) = $userId OR toLower(coalesce(u.email, '')) = toLower($userEmail)
      RETURN elementId(u) AS currentUserId, c.id AS conversationId
      LIMIT 1
    `;

    const authRes = await session.run(authQuery, {
      id,
      userId: req.user.id || '',
      userEmail: req.user.email || '',
    });

    if (authRes.records.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You are not a participant in this private conversation.',
      });
    }

    const currentUserId = authRes.records[0].get('currentUserId');

    // 2. Mark incoming messages as read
    const markReadQuery = `
      MATCH (c:Conversation {id: $id})-[:CONTAINS_MESSAGE]->(m:Message)
      WHERE m.read = false AND m.senderId <> $currentUserId
      SET m.read = true
    `;
    await session.run(markReadQuery, { id, currentUserId });

    // 3. Fetch chronological messages (deduplicated by message node)
    const messagesQuery = `
      MATCH (c:Conversation {id: $id})-[:CONTAINS_MESSAGE]->(m:Message)
      WITH DISTINCT m
      RETURN 
        m.id AS id,
        m.text AS text,
        m.senderId AS senderId,
        m.senderName AS senderName,
        m.senderRole AS senderRole,
        toString(m.createdAt) AS createdAt,
        m.read AS read
      ORDER BY m.createdAt ASC
      LIMIT 200
    `;

    const result = await session.run(messagesQuery, { id });

    const messages = result.records.map((r) => ({
      id: r.get('id'),
      text: r.get('text'),
      senderId: r.get('senderId'),
      senderName: r.get('senderName'),
      senderRole: r.get('senderRole'),
      createdAt: sanitizeNeo4jValue(r.get('createdAt')),
      read: r.get('read'),
      isSelf: r.get('senderId') === currentUserId,
    }));

    return res.json({
      success: true,
      count: messages.length,
      data: messages,
    });
  } catch (error) {
    console.error('[Chat] Error fetching messages:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve messages from database.',
    });
  } finally {
    await session.close();
  }
});

/**
 * POST /api/chat/conversations/:id/messages
 * Send a message inside an accepted conversation.
 * Authorizes participant and persists message node.
 */
router.post('/conversations/:id/messages', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { text = '' } = req.body;
  const cleanText = (text || '').trim();

  if (!cleanText) {
    return res.status(400).json({
      success: false,
      error: 'Message text cannot be empty.',
    });
  }

  if (cleanText.length > 2000) {
    return res.status(400).json({
      success: false,
      error: 'Message exceeds maximum limit of 2000 characters.',
    });
  }

  const session = getSession(neo4j.session.WRITE);

  try {
    // 1. Authorize: verify participation
    const authQuery = `
      MATCH (u)-[:PARTICIPATES_IN]->(c:Conversation {id: $id})
      WHERE elementId(u) = $userId OR toLower(coalesce(u.email, '')) = toLower($userEmail)
      RETURN elementId(u) AS userId, u.name AS userName, labels(u)[0] AS userRole
      LIMIT 1
    `;

    const authRes = await session.run(authQuery, {
      id,
      userId: req.user.id || '',
      userEmail: req.user.email || '',
    });

    if (authRes.records.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You are not authorized to send messages in this conversation.',
      });
    }

    const uRecord = authRes.records[0];
    const senderDbId = uRecord.get('userId');
    const senderName = uRecord.get('userName');
    const senderRole = uRecord.get('userRole');

    // 2. Prevent rapid duplicate submissions (e.g. double-clicks within 2s) by the same sender
    const dupCheckQuery = `
      MATCH (c:Conversation {id: $id})-[:CONTAINS_MESSAGE]->(m:Message)
      WHERE m.senderId = $senderDbId AND m.text = $cleanText
        AND m.createdAt > (datetime() - duration({seconds: 2}))
      RETURN 
        m.id AS id,
        m.text AS text,
        m.senderId AS senderId,
        m.senderName AS senderName,
        m.senderRole AS senderRole,
        toString(m.createdAt) AS createdAt,
        m.read AS read
      LIMIT 1
    `;
    const dupRes = await session.run(dupCheckQuery, { id, senderDbId, cleanText });
    if (dupRes.records.length > 0) {
      const dupRecord = dupRes.records[0];
      return res.status(200).json({
        success: true,
        data: {
          id: dupRecord.get('id'),
          text: dupRecord.get('text'),
          senderId: dupRecord.get('senderId'),
          senderName: dupRecord.get('senderName'),
          senderRole: dupRecord.get('senderRole'),
          createdAt: sanitizeNeo4jValue(dupRecord.get('createdAt')),
          read: dupRecord.get('read'),
          isSelf: true,
        },
      });
    }

    // 3. Create message and link to conversation
    const messageId = `msg_${crypto.randomUUID()}`;
    const sendQuery = `
      MATCH (c:Conversation {id: $id})
      MATCH (u) WHERE elementId(u) = $senderDbId
      CREATE (m:Message {
        id: $messageId,
        text: $cleanText,
        senderId: $senderDbId,
        senderName: $senderName,
        senderRole: $senderRole,
        createdAt: datetime(),
        read: false
      })
      MERGE (c)-[:CONTAINS_MESSAGE]->(m)
      MERGE (u)-[:SENT]->(m)
      SET c.updatedAt = datetime()
      RETURN 
        m.id AS id,
        m.text AS text,
        m.senderId AS senderId,
        m.senderName AS senderName,
        m.senderRole AS senderRole,
        toString(m.createdAt) AS createdAt,
        m.read AS read
    `;

    const sendRes = await session.run(sendQuery, {
      id,
      senderDbId,
      senderName,
      senderRole,
      messageId,
      cleanText,
    });

    const m = sendRes.records[0];

    return res.status(201).json({
      success: true,
      data: {
        id: m.get('id'),
        text: m.get('text'),
        senderId: m.get('senderId'),
        senderName: m.get('senderName'),
        senderRole: m.get('senderRole'),
        createdAt: sanitizeNeo4jValue(m.get('createdAt')),
        read: m.get('read'),
        isSelf: true,
      },
    });
  } catch (error) {
    console.error('[Chat] Error sending message:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send message.',
    });
  } finally {
    await session.close();
  }
});

export default router;
