// main.js
let pyodide = null;
let sim = null;
let autoRunning = false;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const logEl = document.getElementById('log');

function log(msg) {
  logEl.innerHTML = msg + '<br/>' + logEl.innerHTML;
}

// load pyodide and python simulation
async function initPyodideAndSim(){
  log("Loading Python runtime (Pyodide)...");
  pyodide = await loadPyodide({indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/"});
  log("Pyodide ready.");

  // load the python simulation source
  const pyCode = await (await fetch('/sim.py')).text();
  pyodide.runPython(pyCode);
  sim = pyodide.globals.get("RogueAPSimulation")(); // instantiate class
  log("Python simulation loaded.");
}

function draw(state) {
  // state is a JS object returned from Python
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // draw trusted AP
  const t = state.trusted_ap;
  const r = state.rogue_ap;
  drawAP(t, "Trusted", t.x, t.y, t.strength, "#27ae60");
  drawAP(r, "Rogue", r.x, r.y, r.strength, "#e74c3c");

  // draw clients
  for (const c of state.clients) {
    drawClient(c);
  }
}

function drawAP(ap, label, x, y, strength, color) {
  // signal radius (scaled)
  const radius = Math.min(160, strength * 1.8);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI*2);
  ctx.fillStyle = hexToRgba(color, 0.06);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI*2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.fillStyle = "#dff1ff";
  ctx.font = "12px Arial";
  ctx.fillText(label + " (s=" + strength + ")", x+14, y+4);
}

function drawClient(c) {
  ctx.beginPath();
  ctx.arc(c.x, c.y, 7, 0, Math.PI*2);
  ctx.fillStyle = c.connected_to === "rogue" ? "#ffb3b3" : (c.connected_to === "trusted" ? "#b3ffb9" : "#d1d7ff");
  ctx.fill();
  ctx.fillStyle="#dbe9ff";
  ctx.font="12px Arial";
  ctx.fillText(c.name, c.x+10, c.y+4);
  if (c.connected_to) {
    ctx.strokeStyle = hexToRgba(c.connected_to === "rogue" ? "#ff7b7b" : "#7be07b", 0.7);
    ctx.beginPath();
    const apx = c.connected_to === "rogue" ? parseFloat(c.rogue_x) : parseFloat(c.trusted_x);
    const apy = c.connected_to === "rogue" ? parseFloat(c.rogue_y) : parseFloat(c.trusted_y);
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(apx, apy);
    ctx.stroke();
  }
}

function hexToRgba(hex, alpha){
  // simple mapping for a few colors
  const map = {"#27ae60":[39,174,96],"#e74c3c":[231,76,60],"#ff7b7b":[255,123,123],"#7be07b":[123,224,123]};
  const rgb = map[hex] || [200,200,200];
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

async function updateFromControlsAndRender(step=false){
  const n = parseInt(document.getElementById('numClients').value);
  const trustedStrength = parseInt(document.getElementById('trustedStrength').value);
  const rogueStrength = parseInt(document.getElementById('rogueStrength').value);
  // call python to reset if needed
  if (step === false) {
    // fresh start
    sim.callMethod("reset", n, trustedStrength, rogueStrength);
  } else {
    sim.callMethod("step");
  }
  const state = pyodide.runPython("sim_state = sim.get_state(); sim_state", {globals: pyodide.globals});
  // convert PyProxy objects to JS plain object
  const jsState = state.toJs ? state.toJs() : state;
  draw(jsState);
  log("Rendered step. Clients connected to rogue: " + jsState.clients.filter(c=>c.connected_to==='rogue').length);
}

document.getElementById('startBtn').addEventListener('click', async () => {
  await updateFromControlsAndRender(false);
});

document.getElementById('stepBtn').addEventListener('click', async () => {
  await updateFromControlsAndRender(true);
});

document.getElementById('autoBtn').addEventListener('click', async () => {
  autoRunning = !autoRunning;
  document.getElementById('autoBtn').innerText = autoRunning ? "Stop Auto" : "Auto Run";
  while (autoRunning) {
    await updateFromControlsAndRender(true);
    await new Promise(r=>setTimeout(r, 700));
  }
});

(async () => {
  await initPyodideAndSim();
  // expose sim to pyodide globals for JS calls
  pyodide.globals.set("sim", sim);
  // initial render
  await updateFromControlsAndRender(false);
})();
