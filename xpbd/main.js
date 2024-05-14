"use strict";
import { Point, geometrySingleton } from "./geometry";


// Canvas setup
const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth; 
canvas.height = window.innerHeight;

const numberOfPoints = 40;
const r = 2; 
const clothSide = 500;
const distanceCoef = clothSide/numberOfPoints;
const startX = (window.innerWidth-(distanceCoef*(numberOfPoints-1)))/2;
const startY = (window.innerHeight-(distanceCoef*(numberOfPoints-1)))/2;

// Inicijalizacija tacaka
let points = [];
for(let i=0; i<numberOfPoints; ++i)
{
    points.push([]);
    for(let j=0; j<numberOfPoints; ++j)
    {
        points[i].push(new Point(startX+distanceCoef*j, startY+distanceCoef*i, r, ctx, distanceCoef));
    }
}

// Povezivanje
for(let i=0; i<numberOfPoints; ++i)
{
    for(let j=0; j<numberOfPoints; ++j)
    {
        if(j > 0)
        {
            points[i][j].left = points[i][j-1];
        }
        if(i > 0)
        {
            points[i][j].up = points[i-1][j];
        }
        if (j < numberOfPoints-1)
        {
            points[i][j].right = points[i][j+1];
        }
        if (i < numberOfPoints-1)
        {
            points[i][j].down = points[i+1][j];
        }
    }
}

// Vezani cvorovi
for(let i=0; i<numberOfPoints; ++i)
{
    for(let j=0; j<numberOfPoints; ++j)
    {
        if(points[i][j].tiedNode()) 
        {
            points[i][j].w = 0;
            // console.log(i, j);
        }
    }
}

let paused = false;
let showScreenCenter = false;
let drawPoints = false;
let drawConstraints = false;
let outlineOnly = false;
let framesPerSecond = 30;
let startTime = performance.now();
let previousTime = startTime;
let currentTime = 0;
let deltaTime = 0;
let cameraMatrix = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
]

// Parametri
const steps = 30;
const dt = 1000.0 / framesPerSecond;

// External forces
const g = [0, 9.81 / 500, 0];
let wind = [0.0, 0.0, 0.0];

function xpbd()
{
    let sdt = dt / steps;
    for(let step=0; step < steps; ++step)
    {
        preSolve(sdt, wind);
        solve(sdt);
        postSolve(sdt);
    }
}

//Fw = 1/2 * rho * S * Cd * vw * 2
const rho = 1.293; //air density
const CdS = 0.0001; //1cm^2
const mass = 0.1

let windAcc = [0, 0, 0];
function updateWind(){
    let sliderX = document.getElementById("rangeX");
    let sliderY = document.getElementById("rangeY");
    let sliderZ = document.getElementById("rangeZ");
        
    wind = [sliderX.value, sliderY.value, sliderZ.value];

    windAcc = [0.5 * rho * CdS * wind[0] * wind[0] / mass, 
0.5 * rho * CdS * wind[1] * wind[1] / mass, 0.5 * rho * CdS * wind[2] * wind[2] / mass];
}

let cloudPosition = -360;

function moveClouds(){
    let wind = document.getElementById("rangeX").value;
    let oblaci = document.getElementsByClassName("oblaci");

    let dt = 0.02;
    for(let oblak of oblaci){
        cloudPosition = cloudPosition + wind * dt
        if (cloudPosition >= 100){
            //pomerim za 460 sto je sirina oblaka (400) i dva paddinga (30)
            cloudPosition = -360;
        }
        if (cloudPosition < -360){
            //pomerim za 460 sto je sirina oblaka (400) i dva paddinga (30)
            cloudPosition = 100;
        }

        oblak.style.left = cloudPosition + "px";
    }
}

function blockSun(){
    let oblaci = document.getElementsByClassName("oblaci");
    let sunce = document.getElementById("sunce");

    let rect = sunce.getBoundingClientRect();
    let sunce_x = rect.left + window.scrollX;

    let preklop = 1000;
    for (let oblak of oblaci){
        let rect = oblak.getBoundingClientRect();
        let oblak_x = rect.left + 100;

        if(Math.abs(sunce_x - oblak_x) < preklop){
            preklop = Math.abs(sunce_x - oblak_x);
        }
    }

    let background = document.getElementById("background");
    if(preklop < 150){
        let zatamnjenje = preklop / 3 + 50;
        background.style.filter = "brightness(" + zatamnjenje + "%)";
    }
    else{
        background.style.filter = "brightness(100%)";
    }
}

function weather(){
    updateWind();
    moveClouds();
    blockSun()
}

function preSolve(dt, wind)
{
    for(let i=0; i < numberOfPoints; ++i)
    {
        for(let j=0; j < numberOfPoints; ++j)
        {
            if(points[i][j].w == 0) continue;
            // vec add
            points[i][j].velocity.x += (windAcc[0] + g[0])* dt; 
            points[i][j].velocity.y += (windAcc[1] + g[1]) * dt; 
            points[i][j].velocity.z += (windAcc[2] + g[2]) * dt; 
            
            // vec copy
            points[i][j].previous = [points[i][j].x, points[i][j].y, points[i][j].z];
    
            // vec add
            points[i][j].x += points[i][j].velocity.x * dt; 
            points[i][j].y += points[i][j].velocity.y * dt; 
            points[i][j].z += points[i][j].velocity.z * dt; 
        }
    }
}

function solve(dt) 
{
    solveStretching(dt);
    solveBending(dt);
};

let stretchingEdges = [];
let bendingEdges = [];
for(let i=0; i<numberOfPoints; ++i)
{
    for(let j=0; j<numberOfPoints; ++j)
    {
        if(points[i][j].down != null)
        {            
            stretchingEdges.push({
            first:points[i][j], 
            second:points[i][j].down, 
            restingLen: points[i][j].distance(points[i][j].down)});
            
            // crveno
            if(points[i][j].down.right != null)
            {
                bendingEdges.push({
                    first:points[i][j], 
                    second:points[i][j].down.right, 
                    restingLen: points[i][j].distance(points[i][j].down.right)});
            }
            // zeleno
            if(points[i][j].down.down != null && points[i][j].down.down.left != null)
            {
                bendingEdges.push({
                    first:points[i][j], 
                    second:points[i][j].down.down.left, 
                    restingLen: points[i][j].distance(points[i][j].down.down.left)});
            }
            // zuto
            if(points[i][j].down.left != null && points[i][j].down.left.left != null)
            {
                bendingEdges.push({
                    first:points[i][j], 
                    second:points[i][j].down.left.left, 
                    restingLen: points[i][j].distance(points[i][j].down.left.left)});
            }
        }
        if(points[i][j].right != null)
        {
            stretchingEdges.push({
                first:points[i][j], 
                second:points[i][j].right, 
                restingLen: points[i][j].distance(points[i][j].right)});
        }
    }
}

function solveStretching(dt) 
{
    const stretchCoef = 1.05;
    const alpha = stretchCoef / dt / dt;
    const loggingIndex = -1;
    for(let i=0; i<stretchingEdges.length; ++i)
    {
        let firstPoint = stretchingEdges[i].first;
        let secondPoint = stretchingEdges[i].second;
        const w = firstPoint.w + secondPoint.w;
        if(w == 0.0) continue;
        let edgeLength = firstPoint.distance(secondPoint);
        if(edgeLength == 0.0) continue;
        let vektorPravca = [
            firstPoint.x - secondPoint.x, 
            firstPoint.y - secondPoint.y,
            firstPoint.z - secondPoint.z
        ];

        for(let j=0; j<3; ++j) vektorPravca[j] /= edgeLength;

        if(i == loggingIndex)
            console.log(vektorPravca);
        const restingLen = stretchingEdges[i].restingLen;
        let C = edgeLength - restingLen;
        let s = -C / (w + alpha);
        // vecAdd(this.pos,id0, this.grads,0, s * w0);
        firstPoint.x += vektorPravca[0] * s * firstPoint.w;
        firstPoint.y += vektorPravca[1] * s * firstPoint.w;
        firstPoint.z += vektorPravca[2] * s * firstPoint.w;
        // vecAdd(this.pos,id1, this.grads,0, -s * w1);
        secondPoint.x -= vektorPravca[0] * s * secondPoint.w;
        secondPoint.y -= vektorPravca[1] * s * secondPoint.w;
        secondPoint.z -= vektorPravca[2] * s * secondPoint.w;

        if(i == loggingIndex)
            console.log(stretchingEdges[i].first.x, stretchingEdges[i].first.y, stretchingEdges[i].first.z, stretchingEdges[i].first.velocity);
    }
};

function solveBending(dt)
{
    const bendingCoef = 10.0;
    const alpha = bendingCoef / dt / dt;
    const loggingIndex = -1;
    for(let i=0; i<bendingEdges.length; ++i)
    {
        let firstPoint = bendingEdges[i].first;
        let secondPoint = bendingEdges[i].second;
        const w = firstPoint.w + secondPoint.w;
        if(w == 0.0) continue;
        let edgeLength = firstPoint.distance(secondPoint);
        if(edgeLength == 0.0) continue;
        let vektorPravca = [
            firstPoint.x - secondPoint.x, 
            firstPoint.y - secondPoint.y,
            firstPoint.z - secondPoint.z
        ];

        for(let j=0; j<3; ++j) vektorPravca[j] /= edgeLength;

        if(i == loggingIndex)
            console.log(vektorPravca);
        const restingLen = bendingEdges[i].restingLen;
        let C = edgeLength - restingLen;
        let s = -C / (w + alpha);
        // vecAdd(this.pos,id0, this.grads,0, s * w0);
        firstPoint.x += vektorPravca[0] * s * firstPoint.w;
        firstPoint.y += vektorPravca[1] * s * firstPoint.w;
        firstPoint.z += vektorPravca[2] * s * firstPoint.w;
        // vecAdd(this.pos,id1, this.grads,0, -s * w1);
        secondPoint.x -= vektorPravca[0] * s * secondPoint.w;
        secondPoint.y -= vektorPravca[1] * s * secondPoint.w;
        secondPoint.z -= vektorPravca[2] * s * secondPoint.w;

        if(i == loggingIndex)
            console.log(bendingEdges[i].first.x, bendingEdges[i].first.y, bendingEdges[i].first.z, bendingEdges[i].first.velocity);
    }
};

function postSolve(dt) 
{
    for(let i=0; i < numberOfPoints; ++i)
    {
        for(let j=0; j < numberOfPoints; ++j)
        {
            if(points[i][j].w == 0) continue;
            // vecSetDiff(this.vel,i, this.pos,i, this.prevPos,i, 1.0 / dt);
            points[i][j].velocity.x = (points[i][j].x - points[i][j].previous[0]) / dt;
            points[i][j].velocity.y = (points[i][j].y - points[i][j].previous[1]) / dt;
            points[i][j].velocity.z = (points[i][j].z - points[i][j].previous[2]) / dt;
        }
    }
};

function animate(timestamp)
{
    if(paused) return;
    currentTime = timestamp;
    deltaTime = currentTime - previousTime;
  
    if (deltaTime > dt) 
    {
        weather();

        previousTime = currentTime - (deltaTime % dt);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // rotateX();
        // rotateY();
        // rotateZ();
        xpbd();
        for(const row of points)
        {
            for(const point of row)
            {
                point.draw(drawPoints, drawConstraints, cameraMatrix, outlineOnly);
            }
        }

    }

    // Dodatan info
    if(showScreenCenter)
    {
        ctx.beginPath();
        ctx.arc(window.innerWidth/2, window.innerHeight/2, 3, 0, Math.PI*2);
        ctx.fill();
    }

    window.requestAnimationFrame(animate);
}

function play() 
{
    paused = !paused;
    if(!paused) animate();
}

let direction = 1;
function rotateX(deg=Math.PI/18) 
{
    for(const row of points)
    {
        for(const point of row)
        {
          point.rotateX(direction*deg);
        }
    }
}

function rotateY(deg=Math.PI/18) 
{
    for(const row of points)
    {
        for(const point of row)
        {
          point.rotateY(direction*deg);
        }
    }
}

function rotateZ(deg=Math.PI/18) 
{
    for(const row of points)
    {
        for(const point of row)
        {
          point.rotateZ(direction*deg);
        }
    }
}

function cameraRotateX(deg=Math.PI/18)
{
    deg *= direction;
    if(deg < 0 || deg > Math.PI * 2)
        deg = (deg % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

    if (!geometrySingleton.rotations.has(deg)) {
        geometrySingleton.rotations.set(deg, {
            x: null,
            y: null,
            z: null
        });
    }

    if (!geometrySingleton.rotations.get(deg)["x"]) {
        geometrySingleton.angleReduce(deg, "x");
    }
    
    let rotationMatrix = geometrySingleton.rotations.get(deg)["x"];
    let res = geometrySingleton.matrixMul(rotationMatrix, cameraMatrix);
    for(let i=0; i<res.length; ++i)
    {
        for(let j=0; j<res.length; ++j)
        {
            cameraMatrix[i][j] = res[i][j];
        }
    }
}

function cameraRotateY(deg=Math.PI/18)
{
    deg *= direction;
    if(deg < 0 || deg > Math.PI * 2)
        deg = (deg % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    
    if (!geometrySingleton.rotations.has(deg)) {
        geometrySingleton.rotations.set(deg, {
            x: null,
            y: null,
            z: null
        });
    }
    
    if (!geometrySingleton.rotations.get(deg)["y"]) {
        geometrySingleton.angleReduce(deg, "y");
    }
    
    let rotationMatrix = geometrySingleton.rotations.get(deg)["y"];
    let res = geometrySingleton.matrixMul(rotationMatrix, cameraMatrix);
    for(let i=0; i<res.length; ++i)
    {
        for(let j=0; j<res.length; ++j)
        {
            cameraMatrix[i][j] = res[i][j];
        }
    }
}

function cameraRotateZ(deg=Math.PI/18)
{
    deg *= direction;
    if(deg < 0 || deg > Math.PI * 2)
        deg = (deg % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    
    if (!geometrySingleton.rotations.has(deg)) {
        geometrySingleton.rotations.set(deg, {
            x: null,
            y: null,
            z: null
        });
    }
    
    if (!geometrySingleton.rotations.get(deg)["z"]) {
        geometrySingleton.angleReduce(deg, "z");
    }
    
    let rotationMatrix = geometrySingleton.rotations.get(deg)["z"];
    let res = geometrySingleton.matrixMul(rotationMatrix, cameraMatrix);
    for(let i=0; i<res.length; ++i)
    {
        for(let j=0; j<res.length; ++j)
        {
            cameraMatrix[i][j] = res[i][j];
        }
    }
}

function changeDirection() 
{
    direction *= -1;
}

const controlMapping = [
    play, 
    () => rotateX(), 
    () => rotateY(), 
    () => rotateZ(), 
    () => cameraRotateX(), 
    () => cameraRotateY(), 
    () => cameraRotateZ(), 
    changeDirection
];
const controlsDiv = document.getElementById("controls");

for(let i=0; i<controlsDiv.children.length; ++i)
{
    controlsDiv.children[i].addEventListener("click", controlMapping[i]);
}

console.log(stretchingEdges.length);
console.log(bendingEdges.length);

animate();
