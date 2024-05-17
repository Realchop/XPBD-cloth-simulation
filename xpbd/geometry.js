"use strict";


export class Geometry 
{
    matrixMul(a, b) {
        const aNumRows = a.length;
        const aNumCols = a[0].length;

        const bNumRows = b.length;
        const bNumCols = b[0].length;
    
        let m = new Array(aNumRows);
        for (let r = 0; r < aNumRows; ++r) 
        {
            m[r] = new Array(bNumCols); 
        }

        for (let r = 0; r < aNumRows; ++r) 
        {
            for (let c = 0; c < bNumCols; ++c) 
            {
                m[r][c] = 0;
                for (let i = 0; i < aNumCols; ++i) 
                {
                    m[r][c] += a[r][i] * b[i][c];
                }
            }
        }
    
        return m;
    }

    sinCache = {};
    sin(deg) {
        if(!this.sinCache[deg])
            this.sinCache[deg] = Math.sin(deg);

        return this.sinCache[deg];
    }

    cosCache = {};
    cos(deg) {
        if(!this.cosCache[deg])
            this.cosCache[deg] = Math.cos(deg);

        return this.cosCache[deg];
    }

    rotations = new Map();

    initialize () {
        this.rotations.set(Math.PI, null);
        this.rotations.set(Math.PI / 2, null);
        this.rotations.set(Math.PI / 3, null);
        this.rotations.set(Math.PI / 4, null);
        this.rotations.set(Math.PI / 6, null);
        this.rotations.set(Math.PI / 18, null);

        let t_1 = [
            [ 1, 0, 0, window.innerWidth/2],
            [ 0, 1, 0, window.innerHeight/2],
            [ 0, 0, 1, 0],
            [ 0, 0, 0, 1],
        ];

        let t = [
            [ 1, 0, 0, -window.innerWidth/2],
            [ 0, 1, 0, -window.innerHeight/2],
            [ 0, 0, 1, 0],
            [ 0, 0, 0, 1],
        ];

        let pos = [
            [[1, 1], [1, 2], [2, 1], [2, 2]],
            [[0, 0], [2, 0], [0, 2], [2, 2]],
            [[0, 0], [0, 1], [1, 0], [1, 1]]
        ]
        for (let key of this.rotations.keys()) {
            let axis = {
                x: null,
                y: null,
                z: null
            }
            for (let i=0; i<3; ++i) {
                let p = pos[i];
                let e = [
                    [1, 0, 0, 0],
                    [0, 1, 0, 0],
                    [0, 0, 1, 0],
                    [0, 0, 0, 1]
                ]
                e[p[0][0]][p[0][1]] = this.cos(key);
                e[p[1][0]][p[1][1]] = -this.sin(key);
                e[p[2][0]][p[2][1]] = this.sin(key);
                e[p[3][0]][p[3][1]] = this.cos(key);

                e = this.matrixMul (t_1, e);
                e = this.matrixMul (e, t);
                switch (i) {
                    case 0:
                        axis.x = e;
                        break;
                    case 1:
                        axis.y = e;
                        break;
                    case 2:
                        axis.z = e;
                }
            }
            this.rotations.set(key, axis);
        }
    }

    angleReduce (deg, axis) {
        let degCopy = deg;
        let comp = [];
        let current = 0;
        let angles = [Math.PI, Math.PI / 2, Math.PI / 3, Math.PI / 4, Math.PI / 6, Math.PI / 18];
        while (deg - (Math.PI / 18) >= 0) {
            if (deg - angles[current] >= 0) {
                comp.push (this.rotations.get(angles[current])[axis]);
                deg -= angles[current];
            } else current++;
        }
        let res = comp[0];
        for (let i=1; i<comp.length; ++i) res = this.matrixMul (res, comp[i]);
        this.rotations.get(degCopy)[axis] = res;
    }

    constructor () {
        this.initialize();
    }

}

// Ovo je jako cringe nacin da se ovo radi al ajde
export const geometrySingleton = new Geometry();

export class Point 
{
    x; // X coordinate
    y; // Y coordinate
    z; // Z coordinate
    r; // point radius
    up = null; // above neighbour
    down = null; // below neighbour
    left = null; // left neighbour
    right = null; // right neighbour
    ctx; // canvas 2d drawing context (canvas je html element, ctx je vezan za canvas)
    drawSelf; // if points should be drawn (bool)
    distanceCoef;
    // Novo
    previous;
    velocity;
    w; // inverse mass
    drawX;
    drawY;
    drawZ;

    constructor(x, y, r, ctx, distanceCoef)
    {
        this.x = x;
        this.y = y;
        this.z = 0.0;
        this.r = r;
        this.ctx = ctx;
        this.drawSelf = false;
        this.distanceCoef = distanceCoef;
        // Novo
        this.previous = [x, y, 0.0];
        this.velocity = {};
        this.velocity.x = 0.0;
        this.velocity.y = 0.0;
        this.velocity.z = 0.0;
        this.w = 200;
        this.drawX = x;
        this.drawY = y;
        this.drawZ = 0.0;
    }
    
    tiedNode() 
    {
        return this.up == null && 
            (
                this.left == null || 
                this.right == null //|| 
                // this.left.left == null || 
                // this.right.right == null
            )
    }

    distance(A)
    {
        return Math.sqrt((this.x - A.x) * (this.x - A.x) + 
                         (this.y - A.y) * (this.y - A.y) + 
                         (this.z - A.z) * (this.z - A.z));
    }

    rotateX(deg) 
    {
        if(deg < 0 || deg > Math.PI * 2)
            deg = (deg % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        if (!geometrySingleton.rotations.has(deg)) 
        {
            geometrySingleton.rotations.set(deg, {
                x: null,
                y: null,
                z: null
            });
        }
        if (!geometrySingleton.rotations.get(deg)["x"]) 
        {
            geometrySingleton.angleReduce(deg, "x");
        }

        let rotationMatrix = geometrySingleton.rotations.get(deg)["x"];
        let current = [
            [this.x],
            [this.y],
            [this.z],
            [1]
        ];

        let res = geometrySingleton.matrixMul(rotationMatrix, current);
        this.x = res[0][0];
        this.y = res[1][0];
        this.z = res[2][0];
    }

    rotateY(deg) 
    {
        if(deg < 0 || deg > Math.PI * 2)
            deg = (deg % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        if (!geometrySingleton.rotations.has(deg)) {
            geometrySingleton.rotations.set(deg, {
                x: null,
                y: null,
                z: null
            })
        }
        if (!geometrySingleton.rotations.get(deg)["y"]) {
            geometrySingleton.angleReduce(deg, "y");
        }

        let rotationMatrix = geometrySingleton.rotations.get(deg).y;
        let current = [
            [this.x],
            [this.y],
            [this.z],
            [1]
        ]

        let res = geometrySingleton.matrixMul(rotationMatrix, current);
        this.x = res[0][0];
        this.y = res[1][0];
        this.z = res[2][0];
    }

    rotateZ(deg) 
    {
        if(deg < 0 || deg > Math.PI * 2)
            deg = (deg % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        if (!geometrySingleton.rotations.has(deg)) {
            geometrySingleton.rotations.set(deg, {
                x: null,
                y: null,
                z: null
            })
        }
        if (!geometrySingleton.rotations.get(deg)["z"]) {
            geometrySingleton.angleReduce(deg, "z");
        }

        let rotationMatrix = geometrySingleton.rotations.get(deg).z;
        let current = [
            [this.x],
            [this.y],
            [this.z],
            [1]
        ];

        let res = geometrySingleton.matrixMul(rotationMatrix, current);
        this.x = res[0][0];
        this.y = res[1][0];
        this.z = res[2][0];
    }

    draw(overrideDrawSelf=false, drawConstraints=false, outline=false) 
    {
        if(overrideDrawSelf || this.drawSelf)
        {
            // Posto ne koristimo z, to je implicitna projekcija
            // na ravan Oxy.
            this.ctx.beginPath();
            this.ctx.arc(this.drawX, this.drawY, this.r, 0, Math.PI*2);
            this.ctx.fill();
        }

        if(this.right != null && this.down != null && this.right.down != null){
            this.ctx.beginPath();
            this.ctx.moveTo(this.drawX, this.drawY);
            this.ctx.lineTo(this.right.drawX, this.right.drawY);
            this.ctx.lineTo(this.right.down.drawX, this.right.down.drawY);
            this.ctx.lineTo(this.down.drawX, this.down.drawY);
            this.ctx.fillStyle = 'yellow';
            this.ctx.fill();
            this.ctx.fillStyle = 'black';
        }

        if(this.up !== null)
        {
            if(!outline || this.left === null || this.right === null)
            {
                this.ctx.beginPath();
                this.ctx.moveTo(this.drawX, this.drawY);
                this.ctx.lineTo(this.up.drawX, this.up.drawY);
                this.ctx.stroke();
            }
        }

        if(this.left !== null)
        {
            if(!outline || this.up === null || this.down === null)
            {
                this.ctx.beginPath();
                this.ctx.moveTo(this.drawX, this.drawY);
                this.ctx.lineTo(this.left.drawX, this.left.drawY);
                this.ctx.stroke();
            }
        }

        // Constraints
        if(drawConstraints && this.down != null) 
        {
            // trougao
            if(this.down.left != null)
            {
                this.ctx.beginPath();
                this.ctx.moveTo(this.drawX, this.drawY);
                this.ctx.lineTo(this.down.left.drawX, this.down.left.drawY);
                this.ctx.stroke();
            }
            // crevno
            if(this.down.right != null)
            {
                this.ctx.beginPath();
                this.ctx.moveTo(this.drawX, this.drawY);
                this.ctx.lineTo(this.down.right.drawX, this.down.right.drawY);
                this.ctx.strokeStyle = "red";
                this.ctx.stroke();
                this.ctx.strokeStyle = "black";
            }
            // zeleno
            if(this.down.down != null && this.down.down.left != null)
            {
                this.ctx.beginPath();
                this.ctx.moveTo(this.drawX, this.drawY);
                this.ctx.lineTo(this.down.down.left.drawX, this.down.down.left.drawY);
                this.ctx.strokeStyle = "green";
                this.ctx.stroke();
                this.ctx.strokeStyle = "black";
            }
            // zuto
            if(this.down.left != null && this.down.left.left != null)
            {
                this.ctx.beginPath();
                this.ctx.moveTo(this.drawX, this.drawY);
                this.ctx.lineTo(this.down.left.left.drawX, this.down.left.left.drawY);
                this.ctx.strokeStyle = "yellow";
                this.ctx.stroke();
                this.ctx.strokeStyle = "black";
            }
        }
    }

    updateCamera(cameraMatrix)
    {
        if(!cameraMatrix)
        cameraMatrix = [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [1, 0, 0, 1],
        ];

        let current = [
            [this.x],
            [this.y],
            [this.z],
            [1]
        ];

        let res = geometrySingleton.matrixMul(cameraMatrix, current);
        this.drawX = res[0][0];
        this.drawY = res[1][0];
        this.drawZ = res[2][0];
    }

}
