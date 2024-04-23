"use strict";
import { Point } from "./geometry";


// Canvas setup
const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;  //rezolucija
canvas.height = window.innerHeight;

const numberOfPoints = 30;  //ukupno 900 tacaka
const r = 2;
const clothSide = 500;
const distanceCoef = clothSide/numberOfPoints;  //zajebano
const startX = (window.innerWidth-(distanceCoef*(numberOfPoints-1)))/2;
const startY = (window.innerHeight-(distanceCoef*(numberOfPoints-1)))/2;

let points = [];

for(let i=0; i<numberOfPoints; ++i)
{
    points.push([]);
    for(let j=0; j<numberOfPoints; ++j)
    {
        points[i].push(new Point(startX+distanceCoef*i, startY+distanceCoef*j, r, ctx));
    }
}

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

let paused = false;
let showScreenCenter = true;
let drawPoints = false;
// *************************************************** //
//                     COPY PASTA                      //
let framesPerSecond = 60;
let interval = Math.floor(1000 / framesPerSecond);
let startTime = performance.now();
let previousTime = startTime;
let currentTime = 0;
let deltaTime = 0;
//                       END                          //
// ************************************************** //

// Diskutuj umesto ovog realtime pristupa pre render pristup
function animate(timestamp)
{
    if(paused) return;

    window.requestAnimationFrame(animate);

    currentTime = timestamp;
    deltaTime = currentTime - previousTime;
  
    if (deltaTime > interval) {
      previousTime = currentTime - (deltaTime % interval);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
    //   rotateX(Math.PI/360);
    //   rotateY(Math.PI/360);
    //   rotateZ(Math.PI/360);
      for(const row of points)
      {
          for(const point of row)
          {
            point.draw(drawPoints);
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
}

function play() {
    paused = !paused;
    if(!paused) animate();
}

// let sa idejom da se menja nekim inputom (NE MENJA SE)
function rotateX(deg=Math.PI/10) {
    for(const row of points)
    {
        for(const point of row)
        {
          point.rotateX(deg);
        }
    }
}

function rotateY(deg=Math.PI/10) {
    for(const row of points)
    {
        for(const point of row)
        {
          point.rotateY(deg);
        }
    }
}

function rotateZ(deg=Math.PI/10) {
    for(const row of points)
    {
        for(const point of row)
        {
          point.rotateZ(deg);
        }
    }
}

function changeDirection() {
    deg *= -1;
}

const controlMapping = [play, () => rotateX(), () => rotateY(), () => rotateZ(), changeDirection];
const controlsDiv = document.getElementById("controls");

for(let i=0; i<controlsDiv.children.length; ++i)
{
    controlsDiv.children[i].addEventListener("click", controlMapping[i]);
}

// Ovo mozemo i da maknemo
animate();
