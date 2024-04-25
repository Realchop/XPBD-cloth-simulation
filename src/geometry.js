"use strict";


export class Geometry {
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

    rotations = new Map([
        [Math.PI / 18, null],
        [Math.PI / 6, null],
        [Math.PI / 4, null],
        [Math.PI / 3, null],
        [Math.PI / 2, null],
        [Math.PI, null]
    ]);

    initialize () {
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
            this.rotations[key] = axis;
        }
    }

    constructor () {
        this.initialize();
    }

}

// Ovo je jako cringe nacin da se ovo radi al ajde
const geometrySingleton = new Geometry();

export class Point {
    x; // X coordinate
    y; // Y coordinate
    z; // Z coordinate
    r; // point radius
    g = -9.81; // gravity 
    up = null; // above neighbour
    down = null; // below neighbour
    left = null; // left neighbour
    right = null; // right neighbour
    ctx; // canvas 2d drawing context (canvas je html element, ctx je vezan za canvas)
    drawSelf; // if points should be drawn (bool)

    constructor(x, y, r, ctx) {
        this.x = x;
        this.y = y;
        this.z = 0;
        this.r = r;
        this.ctx = ctx;
        this.drawSelf = false;
    }

    updateSelf() {
        // Ovde ide fizika recimo:
        // this.y -= this.g;
    }

    rotateX(deg) {
        let rotationMatrix = geometrySingleton.rotations[deg].x;
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

    rotateY(deg) {
        let rotationMatrix = geometrySingleton.rotations[deg].y;
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

    rotateZ(deg) {
        let rotationMatrix = geometrySingleton.rotations[deg].z;
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

    draw(overrideDrawSelf=false) {
        this.updateSelf();
        if(overrideDrawSelf || this.drawSelf)
        {
            // Posto ne koristimo z, to je implicitna projekcija
            // na ravan Oxy.
            this.ctx.beginPath();
            this.ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
            this.ctx.fill();
        }

        if(this.up !== null)
        {
            this.ctx.beginPath();
            this.ctx.moveTo(this.x, this.y);
            this.ctx.lineTo(this.up.x, this.up.y);
            this.ctx.stroke();
        }

        if(this.left !== null)
        {
            this.ctx.beginPath();
            this.ctx.moveTo(this.x, this.y);
            this.ctx.lineTo(this.left.x, this.left.y);
            this.ctx.stroke();
        }
    }
}
