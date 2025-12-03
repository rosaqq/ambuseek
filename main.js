let nodes = [], edges = [], network;
let ambulanceNodeId = "ambulance";
const container = document.getElementById('network');

document.getElementById('loadBtn').addEventListener('click', async () => {
    const nodeFile = document.getElementById('nodesFile').files[0];
    const edgeFile = document.getElementById('edgesFile').files[0];
    const infoFile = document.getElementById('infoFile').files[0];

    // --- If no files provided, load defaults from the server ---
    const nodeCSV = nodeFile
        ? await parseCSV(nodeFile)
        : await parseCSVFromURL('/ambuseek/datasets/hard/10/pontos.csv');

    const edgeCSV = edgeFile
        ? await parseCSV(edgeFile)
        : await parseCSVFromURL('/ambuseek/datasets/hard/10/ruas.csv');

    const infoCSV = infoFile
        ? await parseCSV(infoFile)
        : await parseCSVFromURL('/ambuseek/datasets/hard/10/dados_iniciais.csv');   // optional

    const [nodeResults, edgeResults, infoResults] = await Promise.all([
        nodeCSV, edgeCSV, infoCSV
    ]);

    // --- Load nodes ---
    nodes = nodeResults.data.map(r => ({
        id: parseInt(r.id),
        type: String(r.tipo),
        label: String(r.nome),
        score: parseInt(r.prioridade),
        cost: parseFloat(r.tempo_cuidados_minimos),
        color: r.tipo && r.tipo.toLowerCase() === "hospital" ? "#ffc8c8" : "#97C2FC"
    }));

    // --- Load edges ---
    edges = edgeResults.data.map(r => ({
        from: parseInt(r.ponto_origem),
        to: parseInt(r.ponto_destino),
        value: parseInt(r.tempo_transporte),
        color: "#97C2FC" // default blue
    }));

    // --- Load info CSV (optional) ---
    let startPosition = null;
    let totalTime = null;
    if (infoResults.data.length > 0) {
        const row = infoResults.data[0];
        startPosition = parseInt(row.ponto_inicial);
        totalTime = parseFloat(row.tempo_total);
        console.log("Loaded info CSV:", { startPosition, totalTime });
    }

    drawGraph();
    populateDropdowns();

    // You store totalTime globally
    window.totalTimeAvailable = totalTime;

    if (startPosition !== null) {
        const startSelect = document.getElementById('startNode');
        startSelect.value = startPosition;

        // highlight in green
        const nodeSet = network.body.data.nodes;
        nodeSet.update({ id: startPosition, color: { background: 'lightgreen', border: 'lightgreen'}, borderWidth: 2 });
    }

});

async function parseCSVFromURL(url) {
    const resp = await fetch(url);
    const text = await resp.text();
    return Papa.parse(text, {
        header: true,
        dynamicTyping: false,
        skipEmptyLines: true
    });
}


function parseCSV(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            dynamicTyping: false,
            skipEmptyLines: true,
            complete: resolve,
            error: reject
        });
    });
}

function drawGraph() {
    const data = {
        nodes: new vis.DataSet([
            ...nodes,
            { id: ambulanceNodeId, label: "🚑", shape: "text", font: { size: 40 }, hidden: true, physics: false}
        ]),
        edges: new vis.DataSet(edges)
    };

    const options = {
        edges: { smooth: true },
        physics: { enabled: true, stabilization: { iterations: 200 } },
        layout: { improvedLayout: true }
    };

    network = new vis.Network(container, data, options);
    network.setOptions({
        edges: {
            smooth: {
                type: "dynamic"
            },
        },
        physics: {
            enabled: true,
            solver: "forceAtlas2Based",  // works great for connected graphs
            forceAtlas2Based: {
                gravitationalConstant: -100,   // more negative = more repulsion
                centralGravity: 0.03,        // smaller = looser center pull
                springLength: 50,            // longer edges = more spread
                springConstant: 0.02          // smaller = looser springs
            },
            maxVelocity: 50,
            stabilization: { iterations: 500 },
        },
        layout: {
            improvedLayout: true
        },
        nodes: {
            shape: "ellipse",
            size: 15,
            font: { size: 14 }
        }
    })
    console.log("Loaded", nodes.length, "nodes and", edges.length, "edges");
}

// --- fixed A* that uses the edge.value consistently and validates inputs ---
function aStar(startId, goalId) {
    // ensure startId/goalId are numbers
    startId = Number(startId);
    goalId = Number(goalId);

    const adj = {};

    // This loop builds adjacency arrays
    for (const e of edges) {

        // Outbound direction
        if (!adj[e.from]) adj[e.from] = [];
        adj[e.from].push({ to: e.to, cost: Number(e.value) });

        // Add reverse direction too (roads are bidirectional)
        if (!adj[e.to]) adj[e.to] = [];
        adj[e.to].push({ to: e.from, cost: Number(e.value) });
    }

    const openSet = new Set([startId]);
    const cameFrom = {};
    const gScore = {}, fScore = {};
    for (const n of nodes) {
        gScore[n.id] = Infinity;
        fScore[n.id] = Infinity;
    }
    gScore[startId] = 0;
    fScore[startId] = 0;

    while (openSet.size > 0) {
        let current = [...openSet].reduce((a, b) => fScore[a] < fScore[b] ? a : b);

        if (current === goalId) return reconstructPath(cameFrom, current);

        openSet.delete(current);
        for (const neighbor of adj[current] || []) {
            const tentative = gScore[current] + neighbor.cost;
            if (tentative < gScore[neighbor.to]) {
                cameFrom[neighbor.to] = current;
                gScore[neighbor.to] = tentative;
                fScore[neighbor.to] = tentative; // no heuristic for now
                openSet.add(neighbor.to);
            }
        }
    }
    return null;
}


function reconstructPath(cameFrom, current) {
    const path = [current];
    while (cameFrom[current] !== undefined) {
        current = cameFrom[current];
        path.unshift(current);
    }
    return path;
}

// --- populate selects (call this after drawGraph()) ---
function populateDropdowns() {
    const startSelect = document.getElementById('startNode');
    const goalSelect = document.getElementById('goalNode');

    startSelect.innerHTML = '';
    goalSelect.innerHTML = '';

    // placeholder with EMPTY value intentionally - we'll validate that later
    const placeholderStart = document.createElement('option');
    placeholderStart.value = "";
    placeholderStart.textContent = "Select start node...";
    placeholderStart.disabled = false; // keep selectable so .value is "" until user chooses
    placeholderStart.selected = true;
    startSelect.appendChild(placeholderStart);

    const placeholderGoal = document.createElement('option');
    placeholderGoal.value = "";
    placeholderGoal.textContent = "Select goal node...";
    placeholderGoal.disabled = false;
    placeholderGoal.selected = true;
    goalSelect.appendChild(placeholderGoal);

    nodes.forEach(n => {
        const opt1 = document.createElement('option');
        opt1.value = String(n.id);   // values are strings but contain numeric ids
        opt1.textContent = n.label;
        startSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = String(n.id);
        opt2.textContent = n.label;
        goalSelect.appendChild(opt2);
    });
}

// ambulance calculate function
async function simulateAmbulance(startId, totalTime) {
    const patients = nodes.filter(n => n.type.toLowerCase() === "paciente");
    const hospitals = nodes.filter(n => n.type.toLowerCase() === "hospital");
    const nodeSet = network.body.data.nodes;
    const edgeSet = network.body.data.edges;
    const statusDiv = document.getElementById("status");

    // Initialize ambulance in starting pos
    const startPos = network.getPositions([startId])[startId];
    if (startPos) {
        nodeSet.update({ id: ambulanceNodeId, hidden: false });
        network.moveNode(ambulanceNodeId, startPos.x, startPos.y);
    }

    let current = startId;
    let timeLeft = totalTime;
    let totalScore = 0;
    const visited = new Set();
    const pathTaken = [];

    statusDiv.innerText = `🚑 Simulation running... Time left: ${timeLeft.toFixed(1)} min`;

    while (timeLeft > 0 && patients.some(p => !visited.has(p.id))) {
        // Choose next best patient by score/time ratio
        let best = chooseBestPatient(current, timeLeft, patients, hospitals, visited);
        if (!best) break;

        const { patient, pathToPatient, pathToHospital, totalCost } = best;

        // Move to patient
        await animatePath(pathToPatient, nodeSet, edgeSet, statusDiv, timeLeft);
        timeLeft -= pathCost(pathToPatient);

        // Treat patient
        const careTime = parseFloat(patient.cost);
        timeLeft -= careTime;
        totalScore += parseFloat(patient.score);
        visited.add(patient.id);
        statusDiv.innerText += `\n🧍‍♂️ ${patient.label} (${careTime} min)... Time left: ${timeLeft.toFixed(1)} min`;
        await wait(500); // short pause for effect

        // Move to nearest hospital
        await animatePath(pathToHospital, nodeSet, edgeSet, statusDiv, timeLeft);
        timeLeft -= pathCost(pathToHospital);
        current = pathToHospital[pathToHospital.length - 1];
    }

    statusDiv.innerText += `\n✅ Total score: ${totalScore.toFixed(1)}\t| Time left: ${timeLeft.toFixed(1)} min`;
}

// --- helper to choose best patient by score/time ratio ---
function chooseBestPatient(current, timeLeft, patients, hospitals, visited) {
    let best = null;
    let bestRatio = 0;

    for (const p of patients.filter(p => !visited.has(p.id))) {
        const pathToPatient = aStar(current, p.id);
        if (!pathToPatient) continue;
        const costToPatient = pathCost(pathToPatient);

        let nearestHospital = null;
        let pathToHospital = null;
        let costToHospital = Infinity;
        for (const h of hospitals) {
            const ph = aStar(p.id, h.id);
            if (!ph) continue;
            const ch = pathCost(ph);
            if (ch < costToHospital) {
                costToHospital = ch;
                pathToHospital = ph;
                nearestHospital = h;
            }
        }
        if (!pathToHospital) continue;

        const totalCost = costToPatient + parseFloat(p.cost) + costToHospital;
        const ratio = parseFloat(p.score) / totalCost;

        if (totalCost <= timeLeft && ratio > bestRatio) {
            bestRatio = ratio;
            best = { patient: p, pathToPatient, pathToHospital, totalCost };
        }
    }
    return best;
}

// --- helpers ---
function getEdgeWeight(from, to) {
    const e = edges.find(e =>
        (e.from === from && e.to === to) ||
        (e.to === from && e.from === to)
    );
    return e ? e.value : 0;
}

function pathCost(path) {
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
        total += getEdgeWeight(path[i], path[i + 1]);
    }
    return total;
}

function highlightEdge(edgeSet, from, to, color) {
    const e = edges.find(e =>
        (e.from === from && e.to === to) ||
        (e.to === from && e.from === to)
    );
    if (e) edgeSet.update({ id: e.id, color: { color }, width: 3 });
}

function highlightNode(nodeSet, id, color) {
    nodeSet.update({ id, color: { background: color } });
}

function wait(ms) {
    return new Promise(res => setTimeout(res, ms));
}

// --- animation along path ---
async function animatePath(path, nodeSet, edgeSet, statusDiv, timeLeft) {

    if (!path || path.length < 2) return;
    const positions = network.getPositions(path);
    nodeSet.update({ id: ambulanceNodeId, hidden: false }); // make visible

    for (let i = 0; i < path.length - 1; i++) {
        const from = path[i];
        const to = path[i + 1];

        const startPos = positions[from];
        const endPos = positions[to];
        if (!startPos || !endPos) continue;

        const steps = 30; // smoothness
        const delay = 20; // speed (ms per frame)

        highlightEdge(edgeSet, from, to, "red");
        highlightNode(nodeSet, to, nodeSet.get(to).type === "hospital" ? "#00ccff" : "orange");

        for (let step = 0; step <= steps; step++) {
            const x = startPos.x + (endPos.x - startPos.x) * (step / steps);
            const y = startPos.y + (endPos.y - startPos.y) * (step / steps);
            network.moveNode(ambulanceNodeId, x, y);
            await wait(delay);
        }

        timeLeft -= getEdgeWeight(from, to);
        statusDiv.innerText += `\n🚑 Moving: ${from} → ${to}\t| Time left: ${timeLeft.toFixed(1)} min`;
    }
}


// --- updated click handler for "Find Path" (validates selections) ---
document.getElementById('findPathBtn').addEventListener('click', () => {
    const startVal = document.getElementById('startNode').value;
    const goalVal = document.getElementById('goalNode').value;

    // validate that user selected both (placeholder has empty string "")
    if (!startVal || !goalVal) return alert("You must select start and goal from the dropdowns!");

    const start = parseInt(startVal, 10);
    const goal = parseInt(goalVal, 10);
    if (Number.isNaN(start) || Number.isNaN(goal)) return alert("Invalid node selection.");

    const path = aStar(start, goal);
    if (!path) return alert("No path found.");

    // highlight edges along the path
    const edgeSet = network.body.data.edges;
    edgeSet.forEach(edge => {
        // convert from/to numbers to compare
        const from = Number(edge.from);
        const to = Number(edge.to);
        if (path.includes(from) && path.includes(to) &&
            path.indexOf(to) === path.indexOf(from) + 1) {
            edgeSet.update({ id: edge.id, color: { color: 'red' }, width: 3 });
        } else {
            edgeSet.update({ id: edge.id, color: { color: '#848484' }, width: 1 });
        }
    });

    // alert("Path found: " + path.join(" → "));
});

document.getElementById('resetColorsBtn').addEventListener('click', () => {
    if (!network) return;

    const edgeSet = network.body.data.edges;
    edgeSet.forEach(edge => {
        edgeSet.update({
            id: edge.id,
            color: { color: '#97C2FC' }, // default gray edge color
            width: 1
        });
    });
});

document.getElementById('simulateBtn').addEventListener('click', () => {
    const time = window.totalTimeAvailable;
    const start = parseInt(document.getElementById('startNode').value);
    if (!time) return alert("Load info.csv first!");

    simulateAmbulance(start, time);
});