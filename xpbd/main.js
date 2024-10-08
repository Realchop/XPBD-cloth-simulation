"use strict";
import { Point, geometrySingleton } from "./geometry";


// Canvas setup
const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const dpr = window.devicePixelRatio || 1;
canvas.width = window.innerWidth*dpr; 
canvas.height = window.innerHeight*dpr;

const numberOfPoints = 40;
const r = 2; 
const clothSide = 500*dpr;
const distanceCoef = clothSide/numberOfPoints;
const startX = (window.innerWidth*dpr-(distanceCoef*(numberOfPoints-1)))/2;
const startY = (window.innerHeight*dpr-(distanceCoef*(numberOfPoints-1)))/2;

const stipaljka1 = document.getElementById("stipaljka1");
const stipaljka2 = document.getElementById("stipaljka2");
stipaljka1.style.top = stipaljka2.style.top = `${startY/dpr-50}px`;
stipaljka1.style.left = `${startX/dpr-9}px`;
stipaljka2.style.left = `${(startX+distanceCoef*(numberOfPoints-1))/dpr-9}px`;
const sipka = document.getElementById("sipka");
sipka.style.top = `${startY/dpr-50}px`;

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
let framesPerSecond = 60;
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
const steps = 15;
const dt = 15.0 / framesPerSecond;

// External forces
const g = [0, 9.81, 0];

function xpbd()
{
    let sdt = dt / steps;
    for(let step=0; step < steps; ++step)
    {
        preSolve(sdt);
        solve(sdt);
        postSolve(sdt);
    }
}

//Fw = 1/2 * rho * S * Cd * vw ^ 2
const rho = 1.293; //air density
const CdS = 0.0001; //1cm^2

let windAcc = [0, 0, 0];
function updateWind(){
    let sliderX = document.getElementById("rangeX");
    let sliderY = document.getElementById("rangeY");
    let sliderZ = document.getElementById("rangeZ");
        
    let wind = [sliderX.value, sliderY.value, sliderZ.value];

    const w = points[1][0].w;

    windAcc = [0.5 * rho * CdS * Math.abs(wind[0]) * wind[0] * w, 
            0.5 * rho * CdS * Math.abs(wind[1]) * wind[1] * w,
            0.5 * rho * CdS * Math.abs(wind[2]) * wind[2] * w];
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

function preSolve(dt)
{
    for(let i=0; i < numberOfPoints; ++i)
    {
        for(let j=0; j < numberOfPoints; ++j)
        {
            if(points[i][j].w == 0) continue;
            points[i][j].velocity.x += (windAcc[0] + g[0])* dt; 
            points[i][j].velocity.y += (windAcc[1] + g[1]) * dt; 
            points[i][j].velocity.z += (windAcc[2] + g[2]) * dt; 
            
            points[i][j].previous = [points[i][j].x, points[i][j].y, points[i][j].z];
    
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

        const restingLen = stretchingEdges[i].restingLen;
        let C = edgeLength - restingLen;
        let s = -C / (w + alpha);

        firstPoint.x += vektorPravca[0] * s * firstPoint.w;
        firstPoint.y += vektorPravca[1] * s * firstPoint.w;
        firstPoint.z += vektorPravca[2] * s * firstPoint.w;

        secondPoint.x -= vektorPravca[0] * s * secondPoint.w;
        secondPoint.y -= vektorPravca[1] * s * secondPoint.w;
        secondPoint.z -= vektorPravca[2] * s * secondPoint.w;
    }
};

function solveBending(dt)
{
    const bendingCoef = 10.0;
    const alpha = bendingCoef / dt / dt;
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

        const restingLen = bendingEdges[i].restingLen;
        let C = edgeLength - restingLen;
        let s = -C / (w + alpha);

        firstPoint.x += vektorPravca[0] * s * firstPoint.w;
        firstPoint.y += vektorPravca[1] * s * firstPoint.w;
        firstPoint.z += vektorPravca[2] * s * firstPoint.w;

        secondPoint.x -= vektorPravca[0] * s * secondPoint.w;
        secondPoint.y -= vektorPravca[1] * s * secondPoint.w;
        secondPoint.z -= vektorPravca[2] * s * secondPoint.w;
    }
};

function postSolve(dt) 
{
    for(let i=0; i < numberOfPoints; ++i)
    {
        for(let j=0; j < numberOfPoints; ++j)
        {
            if(points[i][j].w == 0) continue;

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
  
    weather();

    previousTime = currentTime - (deltaTime % dt);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    xpbd();
    for(const row of points)
    {
        for(const point of row)
        {
            point.updateCamera(cameraMatrix);
        }
    }

    for(const row of points)
    {
        for(const point of row)
        {
            point.draw(drawPoints, drawConstraints, outlineOnly);
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

animate();
