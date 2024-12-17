import React, { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";

const NODE_COUNT = 500;
const MAX_EDGE_DISTANCE = 150;
const CANVAS_WIDTH = window.innerWidth;
const CANVAS_HEIGHT = window.innerHeight;
const DELAY = 10;

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

const calculateDistance = (node1, node2) => {
  return Math.hypot(node1.x - node2.x, node1.y - node2.y);
};

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
          weight: calculateDistance(node, target), // edge weight is the Euclidean distance
        });
      }
    });
  });
  return edges;
};

const dijkstra = (nodes, edges, startId, endId, onStep) => {
  const distances = {};
  const previous = {};
  const visited = new Set();
  const unvisitedNodes = [...nodes];
  const exploredEdges = []; 

  nodes.forEach((node) => {
    distances[node.id] = Infinity;//unvisited nodes
    previous[node.id] = null;
  });
  distances[startId] = 0;

  while (unvisitedNodes.length > 0) {
    unvisitedNodes.sort((a, b) => distances[a.id] - distances[b.id]);
    const currentNode = unvisitedNodes.shift();

    if (distances[currentNode.id] === Infinity) break;
    if (currentNode.id === endId) break;

    visited.add(currentNode.id);

    onStep(currentNode);

    edges
      .filter((edge) => edge.source.id === currentNode.id || edge.target.id === currentNode.id)
      .forEach((edge) => {
        const neighbor = edge.source.id === currentNode.id ? edge.target : edge.source;
        if (visited.has(neighbor.id)) return;

        const newDistance = distances[currentNode.id] + edge.weight; 
        if (newDistance < distances[neighbor.id]) {
          distances[neighbor.id] = newDistance;
          previous[neighbor.id] = currentNode.id;
          exploredEdges.push(edge); 
        }
      });
  }

  
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
  const pixiAppRef = useRef(null); 
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [shortestPath, setShortestPath] = useState([]);
  const nodesRef = useRef(generateNodes(NODE_COUNT, CANVAS_WIDTH, CANVAS_HEIGHT)); 
  const edgesRef = useRef(generateEdges(nodesRef.current, MAX_EDGE_DISTANCE)); 
  const nodeGraphicsRef = useRef({}); 
  const edgeGraphicsRef = useRef(null); 
  const [isAnimating, setIsAnimating] = useState(false); 
  useEffect(() => {
    pixiAppRef.current = new PIXI.Application({
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: 0xffffff,
    });

    pixiContainer.current.appendChild(pixiAppRef.current.view);

    const app = pixiAppRef.current; 
    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    const nodeGraphics = nodeGraphicsRef.current; 
    edgeGraphicsRef.current = new PIXI.Graphics();

    edgeGraphicsRef.current.lineStyle(1, 0xcccccc, 0.5);
    edges.forEach((edge) => {
      edgeGraphicsRef.current.moveTo(edge.source.x, edge.source.y);
      edgeGraphicsRef.current.lineTo(edge.target.x, edge.target.y);
    });
    app.stage.addChild(edgeGraphicsRef.current);

    nodes.forEach((node) => {
      const graphics = new PIXI.Graphics();
      graphics.beginFill(0x007bff); // Default node color
      graphics.drawCircle(0, 0, 5);
      graphics.endFill();
      graphics.x = node.x;
      graphics.y = node.y;
      graphics.interactive = true;
      graphics.buttonMode = true;

      graphics.on("pointerdown", () => {
        if (selectedNodes.length < 2) {
          setSelectedNodes((prev) => {
            const newSelection = [...prev, node.id];
            return newSelection.length <= 2 ? newSelection : [node.id];
          });
        }
      });

      app.stage.addChild(graphics);
      nodeGraphics[node.id] = graphics; 
    });

    return () => {
      app.destroy(true, true);
    };
  }, [selectedNodes]); 

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
          nodeGraphicsRef.current[currentNode.id].drawCircle(0, 0, 5);
          nodeGraphicsRef.current[currentNode.id].endFill();
        }
      );
      setShortestPath(path);

      const app = pixiAppRef.current; 
      const pathGraphics = new PIXI.Graphics();
      app.stage.addChild(pathGraphics);

      let edgeIndex = 0;
      const animateEdges = () => {
        if (edgeIndex < exploredEdges.length) {
          const edge = exploredEdges[edgeIndex];
          edgeGraphicsRef.current.lineStyle(2, 0x00ff00, 1); 
          edgeGraphicsRef.current.moveTo(edge.source.x, edge.source.y);
          edgeGraphicsRef.current.lineTo(edge.target.x, edge.target.y);

          edgeIndex++;
          setTimeout(animateEdges, DELAY); 
        } else {
          
          let pathIndex = 0;
          const animatePath = () => {
            if (pathIndex < path.length - 1) {
              const currentNode = nodesRef.current.find((n) => n.id === path[pathIndex]);
              const nextNode = nodesRef.current.find((n) => n.id === path[pathIndex + 1]);

              pathGraphics.lineStyle(3, 0xff0000, 1); 
              pathGraphics.moveTo(currentNode.x, currentNode.y);
              pathGraphics.lineTo(nextNode.x, nextNode.y);

              pathIndex++;
              setTimeout(animatePath, DELAY); 
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
