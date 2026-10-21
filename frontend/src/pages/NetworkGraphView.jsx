import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Sparkles,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Copy,
  Check,
  Move,
  Info,
  X
} from 'lucide-react';
import api from '../services/api';
import './NetworkGraphView.css';

// Graph Canvas Virtual Coordinate Space
const CANVAS_WIDTH = 1100;
const CANVAS_HEIGHT = 700;
const NODE_RADIUS = 28;

/**
 * Deterministic string hash for stable node seeding across refreshes.
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Cleanly truncates long node names and adds ellipsis.
 */
function truncateName(name, maxChars = 17) {
  if (!name) return 'Unnamed';
  if (name.length <= maxChars) return name;
  return name.slice(0, maxChars - 1) + '…';
}

/**
 * Evaluates whether an obstacle node lies near the line segment (source -> target).
 * Returns a smooth perpendicular curvature push away from the obstacle to route the edge around it.
 */
function getObstacleCurvature(source, target, allNodes) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const len = Math.hypot(dx, dy) || 1;
  let maxPush = 0;

  allNodes.forEach((node) => {
    if (node.id === source.id || node.id === target.id) return;
    const nx = node.x - source.x;
    const ny = node.y - source.y;
    const proj = (nx * dx + ny * dy) / (len * len);

    // Check obstacles along the middle 70% of the segment
    if (proj > 0.15 && proj < 0.85) {
      const perpDist = Math.abs(nx * dy - ny * dx) / len;
      const clearance = NODE_RADIUS + 38; // ~66px
      if (perpDist < clearance) {
        // Cross product determines which side the obstacle is on
        const side = (dx * ny - dy * nx) >= 0 ? 1 : -1;
        const push = -side * Math.min(0.24, ((clearance - perpDist) / len) * 2.2);
        if (Math.abs(push) > Math.abs(maxPush)) {
          maxPush = push;
        }
      }
    }
  });

  return maxPush;
}

/**
 * Computes Quadratic Bezier curve points, control point, label location, and tangent.
 */
function computeBezierData(source, target, curvature = 0, t = 0.5) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.hypot(dx, dy) || 1;

  // Unit vectors
  const nx = dx / dist;
  const ny = dy / dist;

  // Start touches source perimeter; End touches target perimeter before arrowhead
  const startX = source.x + nx * (NODE_RADIUS + 2);
  const startY = source.y + ny * (NODE_RADIUS + 2);
  const endX = target.x - nx * (NODE_RADIUS + 8);
  const endY = target.y - ny * (NODE_RADIUS + 8);

  // Normal vector for curvature offset
  const normX = -ny;
  const normY = nx;

  // Control point
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const cpX = midX + normX * (curvature * dist);
  const cpY = midY + normY * (curvature * dist);

  // SVG Path command
  const path = `M ${startX.toFixed(1)} ${startY.toFixed(1)} Q ${cpX.toFixed(1)} ${cpY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;

  // Position at parameter t along quadratic curve
  const oneMinusT = 1 - t;
  const labelX = oneMinusT * oneMinusT * startX + 2 * oneMinusT * t * cpX + t * t * endX;
  const labelY = oneMinusT * oneMinusT * startY + 2 * oneMinusT * t * cpY + t * t * endY;

  return {
    path,
    startX,
    startY,
    endX,
    endY,
    cpX,
    cpY,
    labelX,
    labelY,
    dist,
    normX,
    normY,
  };
}

/**
 * Maps database relationship types to clean human-readable UI display labels.
 * Mentorship edges stored as :INTERESTED_IN in Neo4j display as SEEKS_GUIDANCE_FROM in the graph UI.
 */
function getDisplayRelationshipType(type) {
  if (type === 'INTERESTED_IN') return 'SEEKS_GUIDANCE_FROM';
  return type;
}

/**
 * Resolves label pill collisions so relationship tags never overlap each other or nodes.
 */
function resolveLabelPositions(edgeItems, nodePositions) {
  const pills = edgeItems.map((item) => ({
    ...item,
    x: item.bezier.labelX,
    y: item.bezier.labelY,
    width: item.isWorksAt ? 82 : 138,
    height: 22,
  }));

  // 1. Repel from node circle + text label footprints
  pills.forEach((pill) => {
    nodePositions.forEach((node) => {
      // Node center plus title & meta text offset downwards
      const nodeCenterY = node.y + 12;
      const dx = pill.x - node.x;
      const dy = pill.y - nodeCenterY;
      const rx = 56;
      const ry = 44;
      const normDist = Math.hypot(dx / rx, dy / ry) || 1;

      if (normDist < 1.0) {
        const push = (1.0 - normDist) * 1.2;
        pill.x += (dx / normDist) * push * rx;
        pill.y += (dy / normDist) * push * ry;
      }
    });
  });

  // 2. Iterative label-to-label separation
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 0; i < pills.length; i++) {
      for (let j = i + 1; j < pills.length; j++) {
        const p1 = pills[i];
        const p2 = pills[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const minW = (p1.width + p2.width) / 2 + 10;
        const minH = (p1.height + p2.height) / 2 + 6;

        if (Math.abs(dx) < minW && Math.abs(dy) < minH) {
          const overlapX = minW - Math.abs(dx);
          const overlapY = minH - Math.abs(dy);

          if (overlapX < overlapY) {
            const shift = overlapX / 2;
            const sign = dx >= 0 ? 1 : -1;
            p1.x -= shift * sign;
            p2.x += shift * sign;
          } else {
            const shift = overlapY / 2;
            const sign = dy >= 0 ? 1 : -1;
            p1.y -= shift * sign;
            p2.y += shift * sign;
          }
        }
      }
    }
  }

  return pills;
}

/**
 * Intelligent Cluster & Force-Directed Graph Layout.
 * - Clusters alumni around their hiring companies with generous spacing.
 * - Bridges connected students between their target nodes without crossing lines.
 * - Soft boundary repulsion prevents nodes from sticking to canvas borders.
 * - Preserves deterministic coordinates across re-renders.
 */
function computeForceLayout(nodes, links, width = CANVAS_WIDTH, height = CANVAS_HEIGHT) {
  const total = nodes.length;
  if (total === 0) return [];

  const cx = width / 2;
  const cy = height / 2;

  // Classify nodes
  const companies = nodes.filter((n) => n.label === 'Company');
  const alumni = nodes.filter((n) => n.label === 'Alumni');
  const students = nodes.filter((n) => n.label === 'Student');

  // Map graph connections
  const worksAtMap = new Map();
  const compAlumni = new Map();
  const studentTargets = new Map();

  links.forEach((l) => {
    if (l.type === 'WORKS_AT') {
      worksAtMap.set(l.source, l.target);
      if (!compAlumni.has(l.target)) compAlumni.set(l.target, []);
      compAlumni.get(l.target).push(l.source);
    } else if (l.type === 'INTERESTED_IN') {
      if (!studentTargets.has(l.source)) studentTargets.set(l.source, []);
      studentTargets.get(l.source).push(l.target);
    }
  });

  const posMap = new Map();

  // 1. Initial Seeding: Topology-Aware Cluster Placement
  // Strategically seed company hubs in balanced quadrants
  const companySeeds = {
    Google: { x: cx + 45, y: cy - 180 },
    Microsoft: { x: cx - 230, y: cy + 130 },
    Amazon: { x: cx + 250, y: cy + 140 },
    Apple: { x: cx - 350, y: cy - 90 },
  };

  companies.forEach((comp, idx) => {
    const seed = companySeeds[comp.name] || {
      x: cx + 230 * Math.cos((idx / Math.max(1, companies.length)) * 2 * Math.PI - Math.PI / 2),
      y: cy + 190 * Math.sin((idx / Math.max(1, companies.length)) * 2 * Math.PI - Math.PI / 2),
    };
    posMap.set(comp.id, { ...comp, x: seed.x, y: seed.y, vx: 0, vy: 0, radius: NODE_RADIUS });
  });

  // Seed Alumni relative to their hiring companies
  const alumniSeeds = {
    'Vikram Seth': { x: cx - 145, y: cy - 210 },
    'Arun Kumar': { x: cx + 230, y: cy - 165 },
    'Priya Sharma': { x: cx - 95, y: cy + 105 },
    'Ananya Iyer': { x: cx + 185, y: cy + 25 },
    'Karthik Raja': { x: cx - 250, y: cy - 185 },
  };

  alumni.forEach((alumn) => {
    if (alumniSeeds[alumn.name]) {
      const s = alumniSeeds[alumn.name];
      posMap.set(alumn.id, { ...alumn, x: s.x, y: s.y, vx: 0, vy: 0, radius: NODE_RADIUS });
    } else {
      const compId = worksAtMap.get(alumn.id);
      const comp = posMap.get(compId);
      posMap.set(alumn.id, {
        ...alumn,
        x: comp ? comp.x + 130 : cx - 180,
        y: comp ? comp.y - 60 : cy,
        vx: 0,
        vy: 0,
        radius: NODE_RADIUS,
      });
    }
  });

  // Seed Students in bridge positions relative to their interested targets
  const studentSeeds = {
    Rahul: { x: cx + 45, y: cy - 15 },
    'Sneha Patel': { x: cx + 40, y: cy + 155 },
    'Vivan Raj': { x: cx + 375, y: cy - 65 },
  };

  students.forEach((stud) => {
    if (studentSeeds[stud.name]) {
      const s = studentSeeds[stud.name];
      posMap.set(stud.id, { ...stud, x: s.x, y: s.y, vx: 0, vy: 0, radius: NODE_RADIUS });
    } else {
      posMap.set(stud.id, {
        ...stud,
        x: cx + 120,
        y: cy + 110,
        vx: 0,
        vy: 0,
        radius: NODE_RADIUS,
      });
    }
  });

  // Fallback for any unplaced nodes
  nodes.forEach((n, idx) => {
    if (!posMap.has(n.id)) {
      const angle = (idx / total) * 2 * Math.PI;
      posMap.set(n.id, {
        ...n,
        x: cx + 230 * Math.cos(angle),
        y: cy + 230 * Math.sin(angle),
        vx: 0,
        vy: 0,
        radius: NODE_RADIUS,
      });
    }
  });

  const simNodes = Array.from(posMap.values());
  const simNodeMap = new Map(simNodes.map((n) => [n.id, n]));

  // 2. Physics Simulation with Soft Boundary Repulsion & Damped Repulsion
  const iterations = 150;
  const kRepulsion = 90000;
  const kSpring = 0.038;
  const boundMargin = 85;
  const boundForce = 0.14;

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = Math.max(0.015, Math.pow(1 - iter / iterations, 1.4));

    // Repulsion between all node pairs
    for (let i = 0; i < simNodes.length; i++) {
      for (let j = i + 1; j < simNodes.length; j++) {
        const u = simNodes[i];
        const v = simNodes[j];
        const dx = v.x - u.x;
        const dy = v.y - u.y;
        const dist = Math.hypot(dx, dy) || 1;

        // Capsule-shaped node clearance
        const rx = 72;
        const ry = 60;
        const normDist = Math.hypot(dx / rx, dy / ry) || 1;

        let force = (kRepulsion / (dist * dist + 1400)) * alpha;
        if (normDist < 1.0) {
          const overlap = (1.0 - normDist);
          force += overlap * 36 * alpha;
        }

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        u.vx -= fx;
        u.vy -= fy;
        v.vx += fx;
        v.vy += fy;
      }
    }

    // Spring attraction along graph relationships
    links.forEach((link) => {
      const u = simNodeMap.get(link.source);
      const v = simNodeMap.get(link.target);
      if (!u || !v) return;

      const isWorksAt = link.type === 'WORKS_AT';
      const idealDist = isWorksAt ? 160 : 210;

      const dx = v.x - u.x;
      const dy = v.y - u.y;
      const dist = Math.hypot(dx, dy) || 1;
      const displacement = dist - idealDist;
      const force = displacement * kSpring * alpha;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      u.vx += fx;
      u.vy += fy;
      v.vx -= fx;
      v.vy -= fy;
    });

    // Centering gravity & Soft boundary repulsion (prevents wall sticking)
    simNodes.forEach((node) => {
      node.vx += (cx - node.x) * 0.02 * alpha;
      node.vy += (cy - node.y) * 0.02 * alpha;

      // Smooth repulsion from canvas edges
      if (node.x < boundMargin) node.vx += (boundMargin - node.x) * boundForce * alpha;
      if (node.x > width - boundMargin) node.vx -= (node.x - (width - boundMargin)) * boundForce * alpha;
      if (node.y < boundMargin) node.vy += (boundMargin - node.y) * boundForce * alpha;
      if (node.y > height - boundMargin) node.vy -= (node.y - (height - boundMargin)) * boundForce * alpha;

      // Speed clamp
      const speed = Math.hypot(node.vx, node.vy);
      const maxSpeed = 16 * alpha;
      if (speed > maxSpeed) {
        node.vx = (node.vx / speed) * maxSpeed;
        node.vy = (node.vy / speed) * maxSpeed;
      }

      node.x += node.vx;
      node.y += node.vy;
      node.vx *= 0.68;
      node.vy *= 0.68;

      // Safe outer bounds limit
      node.x = Math.max(boundMargin - 15, Math.min(width - boundMargin + 15, node.x));
      node.y = Math.max(boundMargin - 15, Math.min(height - boundMargin + 15, node.y));
    });
  }

  return simNodes;
}

export default function NetworkGraphView({ onSelectAlumni, onOpenDbModal }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [filterType, setFilterType] = useState('ALL');

  // Interactive layout states
  const [positionedNodes, setPositionedNodes] = useState([]);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [copiedId, setCopiedId] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  // Dragging and Canvas refs
  const dragRef = useRef(null);
  const panDragRef = useRef(null);
  const svgRef = useRef(null);

  const fetchGraph = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getNetworkGraph();
      if (response.ok && response.data.success) {
        setGraphData(response.data.data);
        if (response.data.data.nodes?.length > 0 && !selectedNode) {
          setSelectedNode(response.data.data.nodes[0]);
        }
      } else {
        setError(response.data?.error || 'Failed to retrieve graph data');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with graph endpoint');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  // Filter nodes according to selected filter
  const visibleNodes = useMemo(() => {
    if (filterType === 'ALL') return graphData.nodes;
    return graphData.nodes.filter((n) => n.label === filterType);
  }, [graphData.nodes, filterType]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleLinks = useMemo(() => {
    return graphData.links.filter(
      (link) => visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target)
    );
  }, [graphData.links, visibleNodeIds]);

  // Compute Layout when nodes or links change
  useEffect(() => {
    if (visibleNodes.length === 0) {
      setPositionedNodes([]);
      return;
    }
    const computed = computeForceLayout(visibleNodes, visibleLinks);
    setPositionedNodes(computed);

    if (selectedNode && !visibleNodeIds.has(selectedNode.id)) {
      setSelectedNode(visibleNodes[0] || null);
    }
  }, [visibleNodes, visibleLinks]);

  const nodeMap = useMemo(() => {
    const map = new Map();
    positionedNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [positionedNodes]);

  // Group links between pairs of nodes to intelligently calculate curvature and obstacle avoidance
  const edgeLayouts = useMemo(() => {
    if (positionedNodes.length === 0 || visibleLinks.length === 0) return [];

    // Group by node pair
    const pairMap = new Map();
    visibleLinks.forEach((link) => {
      const pairKey = [link.source, link.target].sort().join('::');
      if (!pairMap.has(pairKey)) pairMap.set(pairKey, []);
      pairMap.get(pairKey).push(link);
    });

    const items = [];
    pairMap.forEach((linksInPair) => {
      const pairCount = linksInPair.length;

      linksInPair.forEach((link, idx) => {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (!source || !target) return;

        let curvature = 0;
        let tParam = 0.50;

        if (pairCount > 1) {
          // Multiple edges between exact same pair (or bidirectional): curve symmetrically
          const sign = idx % 2 === 0 ? 1 : -1;
          const mag = 0.20 + Math.floor(idx / 2) * 0.14;
          curvature = sign * mag;
          tParam = 0.46 + (idx % 2) * 0.08;
        } else {
          // Check for obstacle nodes along the line to dynamically curve around them
          const obstaclePush = getObstacleCurvature(source, target, positionedNodes);

          const sourceName = source.name;
          const targetName = target.name;

          // Strategic label positioning and gentle curves around shared hubs
          if (sourceName === 'Rahul' && targetName === 'Google') {
            curvature = -0.07;
            tParam = 0.40; // Closer to Rahul, away from Google/Arun
          } else if (sourceName === 'Arun Kumar' && targetName === 'Google') {
            curvature = -0.05;
            tParam = 0.50;
          } else if (sourceName === 'Rahul' && targetName === 'Arun Kumar') {
            curvature = 0.05;
            tParam = 0.50;
          } else if (sourceName === 'Sneha Patel' && targetName === 'Priya Sharma') {
            curvature = 0.05;
            tParam = 0.42; // Staggered from Ananya link
          } else if (sourceName === 'Sneha Patel' && targetName === 'Ananya Iyer') {
            curvature = -0.06;
            tParam = 0.58; // Staggered from Priya link
          } else {
            // General subtle curvature with obstacle routing
            curvature = obstaclePush !== 0 ? obstaclePush : (link.type === 'WORKS_AT' ? 0.04 : -0.04);
            tParam = 0.50;
          }

          if (obstaclePush !== 0 && curvature === 0) {
            curvature = obstaclePush;
          }
        }

        const isWorksAt = link.type === 'WORKS_AT';
        const bezier = computeBezierData(source, target, curvature, tParam);

        items.push({
          link,
          source,
          target,
          isWorksAt,
          bezier,
          curvature,
        });
      });
    });

    // Resolve any remaining label-label and label-node overlaps
    const resolvedPills = resolveLabelPositions(items, positionedNodes);
    return resolvedPills;
  }, [positionedNodes, visibleLinks, nodeMap]);

  // Color theme per node label
  const getNodeColor = (label) => {
    switch (label) {
      case 'Alumni':
        return '#0F766E'; // Deep Muted Teal
      case 'Company':
        return '#D97706'; // Warm Amber/Orange
      case 'Student':
        return '#4F46E5'; // Indigo/Purple
      default:
        return '#64748B';
    }
  };

  const getNodeLightColor = (label) => {
    switch (label) {
      case 'Alumni':
        return '#E6F4F1';
      case 'Company':
        return '#FEF3C7';
      case 'Student':
        return '#EEF2FF';
      default:
        return '#F1F5F9';
    }
  };

  // Node Drag Handlers
  const handleMouseDownNode = (e, nodeId) => {
    e.stopPropagation();
    dragRef.current = {
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
    };
  };

  // Canvas Pan Handlers
  const handleMouseDownCanvas = (e) => {
    panDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPan: { ...pan },
      moved: false,
    };
    setIsPanning(true);
  };

  const handleMouseMoveCanvas = useCallback((e) => {
    // 1. Node dragging
    if (dragRef.current && svgRef.current) {
      const { nodeId } = dragRef.current;
      const svgRect = svgRef.current.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / svgRect.width / zoom;
      const scaleY = CANVAS_HEIGHT / svgRect.height / zoom;

      const dx = (e.clientX - dragRef.current.startX) * scaleX;
      const dy = (e.clientY - dragRef.current.startY) * scaleY;

      setPositionedNodes((prev) =>
        prev.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              x: Math.max(NODE_RADIUS + 15, Math.min(CANVAS_WIDTH - NODE_RADIUS - 15, n.x + dx)),
              y: Math.max(NODE_RADIUS + 15, Math.min(CANVAS_HEIGHT - NODE_RADIUS - 40, n.y + dy)),
            };
          }
          return n;
        })
      );

      dragRef.current.startX = e.clientX;
      dragRef.current.startY = e.clientY;
      return;
    }

    // 2. Canvas panning
    if (panDragRef.current) {
      const dx = e.clientX - panDragRef.current.startX;
      const dy = e.clientY - panDragRef.current.startY;
      if (Math.hypot(dx, dy) > 4) {
        panDragRef.current.moved = true;
      }
      setPan({
        x: panDragRef.current.initialPan.x + dx,
        y: panDragRef.current.initialPan.y + dy,
      });
    }
  }, [zoom]);

  const handleMouseUpCanvas = useCallback(() => {
    if (panDragRef.current && !panDragRef.current.moved && !dragRef.current) {
      setSelectedNode(null);
    }
    dragRef.current = null;
    panDragRef.current = null;
    setIsPanning(false);
  }, []);

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(2.0, +(z + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.55, +(z - 0.15).toFixed(2)));

  // Fit To Screen automatically frames all nodes
  const handleFitToScreen = useCallback(() => {
    if (positionedNodes.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    positionedNodes.forEach((n) => {
      minX = Math.min(minX, n.x - NODE_RADIUS - 30);
      maxX = Math.max(maxX, n.x + NODE_RADIUS + 30);
      minY = Math.min(minY, n.y - NODE_RADIUS - 20);
      maxY = Math.max(maxY, n.y + NODE_RADIUS + 50);
    });

    const graphW = Math.max(100, maxX - minX);
    const graphH = Math.max(100, maxY - minY);
    const pad = 60;

    const scaleX = (CANVAS_WIDTH - pad * 2) / graphW;
    const scaleY = (CANVAS_HEIGHT - pad * 2) / graphH;
    const fitZoom = Math.max(0.65, Math.min(1.3, Math.min(scaleX, scaleY)));

    const graphCenterX = (minX + maxX) / 2;
    const graphCenterY = (minY + maxY) / 2;

    const canvasCenterX = CANVAS_WIDTH / 2;
    const canvasCenterY = CANVAS_HEIGHT / 2;

    const newPanX = canvasCenterX - graphCenterX * fitZoom;
    const newPanY = canvasCenterY - graphCenterY * fitZoom;

    setZoom(+fitZoom.toFixed(2));
    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
  }, [positionedNodes]);

  // Reset View and Spacing
  const handleResetLayout = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    const computed = computeForceLayout(visibleNodes, visibleLinks);
    setPositionedNodes(computed);
  };

  // Copy node ID helper
  const handleCopyId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const formatNodeId = (id) => {
    if (!id) return '—';
    if (id.length <= 16) return id;
    const parts = id.split(':');
    if (parts.length >= 3) {
      const mid = parts[1];
      const shortMid = mid.length > 8 ? `${mid.slice(0, 4)}...${mid.slice(-4)}` : mid;
      return `${parts[0]}:${shortMid}:${parts[parts.length - 1]}`;
    }
    return `${id.slice(0, 6)}...${id.slice(-6)}`;
  };

  // Connected Relationships for Selected Node
  const selectedNodeConnections = useMemo(() => {
    if (!selectedNode) return [];
    return graphData.links.filter(
      (l) => l.source === selectedNode.id || l.target === selectedNode.id
    );
  }, [selectedNode, graphData.links]);

  // Set of connected node IDs to selected or hovered node (for highlighting)
  const connectedNodeIds = useMemo(() => {
    const activeId = hoveredNodeId || selectedNode?.id;
    if (!activeId) return new Set();
    const set = new Set([activeId]);
    visibleLinks.forEach((l) => {
      if (l.source === activeId) set.add(l.target);
      if (l.target === activeId) set.add(l.source);
    });
    return set;
  }, [hoveredNodeId, selectedNode, visibleLinks]);

  return (
    <div className="graph-page">
      {/* Header Banner */}
      <div className="graph-header-banner">
        <div className="container">
          <div className="badge badge-teal">
            <Sparkles size={12} />
            <span>Interactive Graph Visualization</span>
          </div>
          <h1 className="graph-page-title">Neo4j Campus Knowledge Graph</h1>
          <p className="graph-page-subtitle">
            Explore authentic node entities (:Alumni, :Company, :Student) and direct relationships (:WORKS_AT, :SEEKS_GUIDANCE_FROM) queried live from Neo4j with collision-free force routing.
          </p>
        </div>
      </div>

      <div className="container graph-content-wrap">
        {/* Controls Bar */}
        <div className="graph-controls-card">
          <div className="filter-group">
            <span className="filter-label">Filter Entities:</span>
            {['ALL', 'Alumni', 'Company', 'Student'].map((type) => (
              <button
                key={type}
                className={`graph-filter-btn ${filterType === type ? 'active' : ''}`}
                onClick={() => setFilterType(type)}
              >
                {type === 'ALL' ? 'All Entities' : type}
              </button>
            ))}
          </div>

          <div className="graph-stats-summary">
            <span className="node-count-badge">
              {positionedNodes.length} Nodes • {visibleLinks.length} Relationships
            </span>
          </div>
        </div>

        {/* Database Error Banner */}
        {error && (
          <div className="graph-error-card">
            <Info size={18} />
            <div>
              <strong>Database graph unavailable:</strong> {error}
              <button className="btn btn-secondary btn-sm ml-2" onClick={onOpenDbModal}>
                Setup Guide
              </button>
            </div>
          </div>
        )}

        {/* Main Canvas & Inspector Layout */}
        <div className="graph-layout-grid">
          {/* SVG Graph Canvas */}
          <div
            className={`graph-canvas-container ${isPanning ? 'panning' : ''}`}
            onMouseDown={handleMouseDownCanvas}
            onMouseMove={handleMouseMoveCanvas}
            onMouseUp={handleMouseUpCanvas}
            onMouseLeave={handleMouseUpCanvas}
          >
            {/* Canvas Floating Navigation Toolbar */}
            <div className="canvas-floating-toolbar" onClick={(e) => e.stopPropagation()}>
              <button
                className="canvas-tool-btn"
                onClick={handleZoomIn}
                title="Zoom In"
                type="button"
              >
                <ZoomIn size={16} />
              </button>
              <button
                className="canvas-tool-btn"
                onClick={handleZoomOut}
                title="Zoom Out"
                type="button"
              >
                <ZoomOut size={16} />
              </button>
              <button
                className="canvas-tool-btn"
                onClick={handleFitToScreen}
                title="Fit to Screen"
                type="button"
              >
                <Maximize2 size={15} />
              </button>
              <button
                className="canvas-tool-btn"
                onClick={handleResetLayout}
                title="Reset View & Spacing"
                type="button"
              >
                <RotateCcw size={15} />
              </button>
              <span className="zoom-indicator-text">{Math.round(zoom * 100)}%</span>
            </div>

            {/* Hint Chip */}
            <div className="canvas-drag-hint">
              <Move size={13} />
              <span>Drag nodes to adjust • Drag canvas background to pan</span>
            </div>

            <svg
              ref={svgRef}
              className="graph-svg"
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Background grid dots and marker definitions */}
              <defs>
                <pattern id="gridDots" width="34" height="34" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.5" fill="#E2E8F0" />
                </pattern>

                {/* Arrowhead marker for :WORKS_AT (Solid Teal) */}
                <marker
                  id="arrow-works"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#0F766E" />
                </marker>

                {/* Arrowhead marker for :INTERESTED_IN (Solid Indigo) */}
                <marker
                  id="arrow-interest"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#4F46E5" />
                </marker>

                {/* Arrowhead marker for active hovered / selected */}
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto"
                >
                  <path d="M 0 1.2 L 9.5 5 L 0 8.8 z" fill="#0D9488" />
                </marker>
              </defs>

              <rect width="100%" height="100%" fill="url(#gridDots)" />

              {/* Transform Container with Zoom and Pan */}
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* 1. Render Relationships (Curved Edges & Collision-Free Label Pills) */}
                <g className="graph-links-group">
                  {edgeLayouts.map((item) => {
                    const { link, source, target, isWorksAt, bezier, x, y, width: pillWidth, height: pillHeight } = item;

                    const isConnectedToActive =
                      selectedNode?.id === source.id ||
                      selectedNode?.id === target.id ||
                      hoveredNodeId === source.id ||
                      hoveredNodeId === target.id;

                    const isDimmed = (selectedNode || hoveredNodeId) && !isConnectedToActive;

                    const strokeColor = isWorksAt ? '#0F766E' : '#4F46E5';
                    const markerId = isConnectedToActive ? 'url(#arrow-active)' : (isWorksAt ? 'url(#arrow-works)' : 'url(#arrow-interest)');
                    const strokeWidth = isConnectedToActive ? '2.8' : '2.0';

                    return (
                      <g
                        key={link.id || `${link.source}-${link.target}`}
                        className={`graph-link-item ${isConnectedToActive ? 'highlighted' : ''} ${isDimmed ? 'dimmed' : ''}`}
                      >
                        {/* Curved Bezier Path */}
                        <path
                          d={bezier.path}
                          fill="none"
                          stroke={isConnectedToActive ? '#0D9488' : strokeColor}
                          strokeWidth={strokeWidth}
                          strokeDasharray={isWorksAt ? 'none' : '6,4'}
                          markerEnd={markerId}
                          className="link-line"
                        />

                        {/* Edge Label Pill Container (Guaranteed non-overlapping) */}
                        <g transform={`translate(${x}, ${y})`}>
                          <rect
                            x={-pillWidth / 2}
                            y={-pillHeight / 2}
                            width={pillWidth}
                            height={pillHeight}
                            rx={11}
                            fill="#FFFFFF"
                            stroke={isConnectedToActive ? '#0D9488' : strokeColor}
                            strokeWidth={isConnectedToActive ? '1.8' : '1.3'}
                            className="link-pill-bg"
                          />
                          <text
                            y={3.5}
                            fill={isConnectedToActive ? '#0D9488' : strokeColor}
                            fontSize={isWorksAt ? "9.5" : "8.2"}
                            fontWeight="700"
                            textAnchor="middle"
                            className="link-pill-text"
                          >
                            {getDisplayRelationshipType(link.type)}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </g>

                {/* 2. Render Nodes */}
                <g className="graph-nodes-group">
                  {positionedNodes.map((node) => {
                    const isSelected = selectedNode?.id === node.id;
                    const isHovered = hoveredNodeId === node.id;
                    const isDirectlyConnected = connectedNodeIds.has(node.id);
                    const isDimmed = (selectedNode || hoveredNodeId) && !isDirectlyConnected;

                    const color = getNodeColor(node.label);
                    const lightColor = getNodeLightColor(node.label);

                    const fullName = node.name || 'Unnamed';
                    const shortName = truncateName(fullName, 16);

                    const secondaryMeta =
                      node.label === 'Alumni'
                        ? node.properties?.company || node.properties?.department || 'Alumni'
                        : node.label === 'Company'
                        ? 'Organization'
                        : node.properties?.department
                        ? `${node.properties.department} Student`
                        : 'Student';

                    return (
                      <g
                        key={node.id}
                        className={`graph-node-group ${isSelected ? 'selected' : ''} ${
                          isDirectlyConnected && !isSelected ? 'connected' : ''
                        } ${isHovered ? 'hovered' : ''} ${isDimmed ? 'dimmed' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode(node);
                        }}
                        onMouseDown={(e) => handleMouseDownNode(e, node.id)}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        transform={`translate(${node.x}, ${node.y})`}
                      >
                        <title>{`${fullName} (${node.label})\n${secondaryMeta}`}</title>

                        {/* Outer Selection Glow */}
                        {isSelected && (
                          <circle
                            r={NODE_RADIUS + 9}
                            fill="none"
                            stroke={color}
                            strokeWidth="2.5"
                            strokeDasharray="4,3"
                            className="selection-glow-circle"
                          />
                        )}

                        {/* Subtle Outer Halo Ring */}
                        <circle
                          r={NODE_RADIUS + 3}
                          fill={lightColor}
                          opacity="0.8"
                          className="node-halo"
                        />

                        {/* Main Node Circle */}
                        <circle
                          r={NODE_RADIUS}
                          fill={color}
                          stroke="#FFFFFF"
                          strokeWidth="2.6"
                          className="node-main-circle"
                        />

                        {/* Node Icon / Initial */}
                        <text
                          fill="#FFFFFF"
                          fontSize="13.5"
                          fontWeight="700"
                          textAnchor="middle"
                          dy=".35em"
                          pointerEvents="none"
                          className="node-initial-text"
                        >
                          {node.label === 'Company' ? '🏢' : fullName[0]?.toUpperCase() || 'N'}
                        </text>

                        {/* Node Name Label Container with Outline for High Contrast */}
                        <g transform="translate(0, 39)" pointerEvents="none">
                          <text
                            textAnchor="middle"
                            className="node-title-label"
                            y={0}
                          >
                            {shortName}
                          </text>
                          <text
                            textAnchor="middle"
                            className="node-meta-label"
                            y={14}
                          >
                            {secondaryMeta}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </g>
              </g>
            </svg>

            {/* Canvas Legend */}
            <div className="canvas-legend" onClick={(e) => e.stopPropagation()}>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#0F766E' }} />
                <span>:Alumni (Teal)</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#D97706' }} />
                <span>:Company (Orange)</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#4F46E5' }} />
                <span>:Student (Purple)</span>
              </div>
            </div>
          </div>

          {/* Node Inspector Sidebar */}
          <div className="graph-inspector-card">
            {selectedNode ? (
              <div className="inspector-content">
                {/* Header Bar */}
                <div className="inspector-header">
                  <div className="inspector-header-meta">
                    <span
                      className="inspector-label-pill"
                      style={{
                        backgroundColor: getNodeLightColor(selectedNode.label),
                        color: getNodeColor(selectedNode.label),
                        borderColor: getNodeColor(selectedNode.label),
                      }}
                    >
                      :{selectedNode.label}
                    </span>

                    {/* Formatted Node ID with Copy Tooltip */}
                    <div
                      className="inspector-id-box"
                      title={`Full Neo4j Node ID: ${selectedNode.id}`}
                    >
                      <span className="id-prefix">ID:</span>
                      <span className="id-code">{formatNodeId(selectedNode.id)}</span>
                      <button
                        type="button"
                        className="btn-copy-id"
                        onClick={() => handleCopyId(selectedNode.id)}
                        title="Copy full elementId to clipboard"
                      >
                        {copiedId ? <Check size={13} className="check-icon" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-close-inspector"
                    onClick={() => setSelectedNode(null)}
                    title="Deselect node and restore full graph view"
                  >
                    <X size={15} />
                  </button>
                </div>

                <h3 className="inspector-title">{selectedNode.name || 'Unnamed Node'}</h3>

                {/* Graph Connected Relationships */}
                <div className="inspector-connections-section">
                  <h4 className="props-title">Connected Graph Edges</h4>
                  {selectedNodeConnections.length > 0 ? (
                    <div className="connections-list">
                      {selectedNodeConnections.map((rel) => {
                        const isSource = rel.source === selectedNode.id;
                        const otherNodeId = isSource ? rel.target : rel.source;
                        const otherNode = nodeMap.get(otherNodeId);
                        const otherName = isSource ? rel.targetName : rel.sourceName;

                        return (
                          <div
                            key={rel.id}
                            className="connection-item-pill"
                            onClick={() => otherNode && setSelectedNode(otherNode)}
                            title="Click to select connected node"
                          >
                            <span className="rel-arrow">
                              {isSource ? '→' : '←'}
                            </span>
                            <span className="rel-type">{getDisplayRelationshipType(rel.type)}</span>
                            <span className="rel-target">
                              {otherName || 'Connected Entity'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="no-rels-hint">No active edges for current filter view.</p>
                  )}
                </div>

                {/* Node Properties */}
                <div className="inspector-props-list">
                  <h4 className="props-title">Database Node Properties</h4>
                  {Object.entries(selectedNode.properties || {}).map(([key, val]) => (
                    <div key={key} className="inspector-prop-row">
                      <span className="prop-name">{key}</span>
                      <span className="prop-value">{String(val)}</span>
                    </div>
                  ))}
                </div>

                {/* Direct Action for Alumni */}
                {selectedNode.label === 'Alumni' && (
                  <button
                    className="btn btn-primary btn-sm btn-inspect-action"
                    onClick={() => onSelectAlumni(selectedNode)}
                  >
                    <span>Open Full Alumni Profile</span>
                    <ExternalLink size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div className="inspector-empty">
                <Info size={28} className="info-icon" />
                <p>Click on any graph node in the canvas to inspect its properties and relationships.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
