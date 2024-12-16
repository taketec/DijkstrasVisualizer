import React, { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";

// Constants
const NODE_COUNT = 500;
const MAX_EDGE_DISTANCE = 150;
const CANVAS_WIDTH = window.innerWidth;
const CANVAS_HEIGHT = window.innerHeight;
const DELAY = 10; // 50ms delay after each edge visit

// Helper to generate random nodes
const generateNodes = (count, width, height) => {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      id: i,
      x: Math.random() * width,
      y: Math.random() * height,
    });
  }
  return nodes;
};

// Helper to calculate Euclidean distance between two nodes
const calculateDistance = (node1, node2) => {
  return Math.hypot(node1.x - node2.x, node1.y - node2.y);
};

// Helper to generate edges based on distance
const generateEdges = (nodes, maxDistance) => {
  const edges = [];
  nodes.forEach((node) => {
    nodes.forEach((target) => {
      if (
        node.id !== target.id &&
        calculateDistance(node, target) < maxDistance
      ) {
        edges.push({
          source: node,
          target,
          weight: calculateDistance(node, target), // Edge weight is the Euclidean distance
        });
      }
    });
  });
  return edges;
};

// Dijkstra's algorithm with step-by-step exploration
const dijkstra = (nodes, edges, startId, endId, onStep) => {
  const distances = {};
  const previous = {};
  const visited = new Set();
  const unvisitedNodes = [...nodes];
  const exploredEdges = []; // Store edges to animate

  // Initialize distances
  nodes.forEach((node) => {
    distances[node.id] = Infinity;
    previous[node.id] = null;
  });
  distances[startId] = 0;

  while (unvisitedNodes.length > 0) {
    // Find the node with the smallest distance
    unvisitedNodes.sort((a, b) => distances[a.id] - distances[b.id]);
    const currentNode = unvisitedNodes.shift();

    if (distances[currentNode.id] === Infinity) break;
    if (currentNode.id === endId) break;

    visited.add(currentNode.id);

    // Notify the visualization of this step
    onStep(currentNode);

    // Update distances for neighbors
    edges
      .filter((edge) => edge.source.id === currentNode.id || edge.target.id === currentNode.id)
      .forEach((edge) => {
        const neighbor = edge.source.id === currentNode.id ? edge.target : edge.source;
        if (visited.has(neighbor.id)) return;

        const newDistance = distances[currentNode.id] + edge.weight; // Use the weight of the edge
        if (newDistance < distances[neighbor.id]) {
          distances[neighbor.id] = newDistance;
          previous[neighbor.id] = currentNode.id;
          exploredEdges.push(edge); // Store this edge for animation
        }
      });
  }

  // Reconstruct the shortest path
  const path = [];
  let currentId = endId;
  while (currentId !== null) {
    path.unshift(currentId);
    currentId = previous[currentId];
  }
  return { path, exploredEdges };
};

const Graph = () => {
  const pixiContainer = useRef(null);
  const pixiAppRef = useRef(null); // Ref to store the PixiJS app
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [shortestPath, setShortestPath] = useState([]);
  const nodesRef = useRef(generateNodes(NODE_COUNT, CANVAS_WIDTH, CANVAS_HEIGHT)); // Store nodes
  const edgesRef = useRef(generateEdges(nodesRef.current, MAX_EDGE_DISTANCE)); // Store edges
  const nodeGraphicsRef = useRef({}); // Ref to store node graphics for interactivity
  const edgeGraphicsRef = useRef(null); // Ref to store edge graphics
  const [isAnimating, setIsAnimating] = useState(false); // Track if animation is running

  useEffect(() => {
    pixiAppRef.current = new PIXI.Application({
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: 0xffffff,
    });

    pixiContainer.current.appendChild(pixiAppRef.current.view);

    const app = pixiAppRef.current; // Use the Pixi app from the ref

    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    const nodeGraphics = nodeGraphicsRef.current; // Access node graphics through the ref
    edgeGraphicsRef.current = new PIXI.Graphics(); // Initialize edge graphics here

    // Draw edges
    edgeGraphicsRef.current.lineStyle(1, 0xcccccc, 0.5);
    edges.forEach((edge) => {
      edgeGraphicsRef.current.moveTo(edge.source.x, edge.source.y);
      edgeGraphicsRef.current.lineTo(edge.target.x, edge.target.y);
    });
    app.stage.addChild(edgeGraphicsRef.current);

    // Draw nodes
    nodes.forEach((node) => {
      const graphics = new PIXI.Graphics();
      graphics.beginFill(0x007bff); // Default node color
      graphics.drawCircle(0, 0, 5);
      graphics.endFill();
      graphics.x = node.x;
      graphics.y = node.y;
      graphics.interactive = true;
      graphics.buttonMode = true;

      // Handle node click
      graphics.on("pointerdown", () => {
        if (selectedNodes.length < 2) {
          setSelectedNodes((prev) => {
            const newSelection = [...prev, node.id];
            return newSelection.length <= 2 ? newSelection : [node.id];
          });
        }
      });

      app.stage.addChild(graphics);
      nodeGraphics[node.id] = graphics; // Store the node graphics by node id
    });

    // Cleanup Pixi.js app on component unmount
    return () => {
      app.destroy(true, true);
    };
  }, [selectedNodes]); // Re-run this effect if selectedNodes changes

  // Handle pathfinding when two nodes are selected
  useEffect(() => {
    if (selectedNodes.length === 2 && !isAnimating) {
      const [start, end] = selectedNodes;
      setIsAnimating(true);

      const { path, exploredEdges } = dijkstra(
        nodesRef.current,
        edgesRef.current,
        start,
        end,
        (currentNode) => {
          // Highlight nodes being visited
          //nodeGraphicsRef.current[currentNode.id].beginFill(0x00ff00); // Green for visited nodes
          nodeGraphicsRef.current[currentNode.id].drawCircle(0, 0, 5);
          nodeGraphicsRef.current[currentNode.id].endFill();
        }
      );
      setShortestPath(path);

      const app = pixiAppRef.current; // Use the Pixi app from the ref
      const pathGraphics = new PIXI.Graphics();
      app.stage.addChild(pathGraphics);

      // Visualize the exploration of edges (make them green)
      let edgeIndex = 0;
      const animateEdges = () => {
        if (edgeIndex < exploredEdges.length) {
          const edge = exploredEdges[edgeIndex];
          edgeGraphicsRef.current.lineStyle(2, 0x00ff00, 1); // Green for explored edges
          edgeGraphicsRef.current.moveTo(edge.source.x, edge.source.y);
          edgeGraphicsRef.current.lineTo(edge.target.x, edge.target.y);

          edgeIndex++;
          setTimeout(animateEdges, DELAY); // Delay to animate the exploration of edges
        } else {
          // After all edges are explored, animate the shortest path
          let pathIndex = 0;
          const animatePath = () => {
            if (pathIndex < path.length - 1) {
              const currentNode = nodesRef.current.find((n) => n.id === path[pathIndex]);
              const nextNode = nodesRef.current.find((n) => n.id === path[pathIndex + 1]);

              pathGraphics.lineStyle(3, 0xff0000, 1); // Red for the final shortest path
              pathGraphics.moveTo(currentNode.x, currentNode.y);
              pathGraphics.lineTo(nextNode.x, nextNode.y);

              pathIndex++;
              setTimeout(animatePath, DELAY); // Delay to animate the pathfinding process
            } else {
              setIsAnimating(false);
            }
          };

          animatePath();
        }
      };

      animateEdges();
    }
  }, [selectedNodes, isAnimating]);

  return (
    <div ref={pixiContainer} style={{ width: "100%", height: "100%" }}>
      <div style={{ position: "absolute", zIndex: 10, color: "black" }}>
      </div>
    </div>
  );
};

export default Graph;
