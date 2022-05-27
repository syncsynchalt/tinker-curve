import * as curve from './real-curve.js';
import * as common from '../common.js';
const TWO_PI = 2 * Math.PI;

let dimensions = {xMin: -4, xMax: 9, yMin: -24, yMax: 24};
const curveColor = '#33f';

/** @param ctx {CanvasRenderingContext2D} */
function preCalcValues(ctx) {
    const dotRadius = 3;
    const w = ctx.canvas.getBoundingClientRect().width;
    const h = ctx.canvas.getBoundingClientRect().height;

    const d = dimensions;
    return {
        ctx, w, h, dotRadius,
        xMin: d.xMin, xMax: d.xMax, xSpan: d.xMax - d.xMin,
        yMin: d.yMin, yMax: d.yMax, ySpan: d.yMax - d.yMin
    };
}

/**
 * Given an x,y point return the coordinates transformed for the JS Canvas context
 * (adjusted for top-left origin and half-pixel anti-aliasing)
 *
 * @param vals {Object} values from preCalcValues(ctx)
 * @param x {Number} between 0 and p
 * @param y {Number} between 0 and p
 * @param halfPixel {Boolean?} if set, round all pixels to nearest .5 (true) or .0 (false)
 * @return {Number[2]} x,y values transformed for canvas context
 */
function pointToCtx(vals, x, y, halfPixel) {
    let v = [(x - vals.xMin) / vals.xSpan * vals.w,
        vals.h - ((y - vals.yMin) / vals.ySpan * vals.h)];
    if (halfPixel) {
        v[0] = ((v[0]+0.5) | 0) - 0.5;
        v[1] = ((v[1]+0.5) | 0) - 0.5;
    } else if (halfPixel === false) {
        v[0] = ((v[0]+0.5) | 0);
        v[1] = ((v[1]+0.5) | 0);
    }
    return v;
}

/**
 * @param vals {Object} return from cacheVals
 * @param x {Number} coordinate
 * @param y {Number} coordinate
 * @param color {String} fill style
 * @param radiusAdj {Number?} adjustment to built-in dot radius
 * @param lw {Number?} line width
 * @return {Number[2]} x,y (in canvas context) of center of dot
 */
function drawDot(vals, x, y, color, radiusAdj, lw) {
    const ctx = vals.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'black';
    ctx.fillStyle = color;
    ctx.lineWidth = lw || 1;
    const p = pointToCtx(vals, x, y, true);
    ctx.arc(...p, vals.dotRadius + (radiusAdj || 0), 0, TWO_PI);
    if (lw !== 0) {
        ctx.stroke();
    }
    ctx.fill();
    ctx.beginPath();
    ctx.restore();
    return p;
}

/**
 * Plot the given nP point (and label it)
 * @param vals {Object} return from cacheVals
 * @param n {Number} scalar multiplier
 * @param nP {Point} point to plot
 */
function plotPoint(vals, n, nP) {
    const ctx = vals.ctx;
    ctx.save();
    const p = drawDot(vals, nP.x, nP.y, 'black');
    const tangentSlope = curve.slope(nP, nP);
    ctx.fillStyle = 'black';
    ctx.font = '14px sans';
    ctx.textAlign = 'left';
    let yDecile = Math.ceil(10 * (nP.y - vals.yMin) / vals.ySpan);
    let yAdj;
    if (yDecile === 6 || (tangentSlope < 0 && yDecile !== 5)) {
        ctx.textBaseline = 'bottom';
        yAdj = -4;
    } else {
        ctx.textBaseline = 'top';
        yAdj = +6;
    }
    ctx.fillText(`${n === 1 ? '' : n}P`, p[0]+2, p[1]+yAdj);
    ctx.restore();
}

/**
 * Draw the x/y axes and ticks
 * @param ctx {CanvasRenderingContext2D}
 * @param vals {Object} return from preCalcValues()
 */
function drawAxes(ctx, vals) {
    ctx.strokeStyle = 'grey';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(...pointToCtx(vals, vals.xMin, 0, true));
    ctx.lineTo(...pointToCtx(vals, vals.xMax, 0, true));
    ctx.moveTo(...pointToCtx(vals, 0, vals.yMin, true));
    ctx.lineTo(...pointToCtx(vals, 0, vals.yMax, true));
    for (let i = Math.floor(vals.xMin); i <= vals.xMax; i++) {
        const p = pointToCtx(vals, i, 0, true);
        ctx.moveTo(p[0], p[1]-2);
        ctx.lineTo(p[0], p[1]+2);
    }
    for (let i = Math.ceil(vals.yMax - vals.yMax % 5); i > vals.yMin; i -= 5) {
        const p = pointToCtx(vals, 0, i, true);
        ctx.moveTo(p[0]-2, p[1]);
        ctx.lineTo(p[0]+2, p[1]);
    }
    ctx.stroke();
}

/**
 * Draw the curve
 * @param ctx {CanvasRenderingContext2D}
 */
function drawCurve(ctx) {
    const canvas = ctx.canvas;
    const vals = preCalcValues(ctx);
    if (ctx['_drawGraphSaveState']) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const img = ctx['_drawGraphSaveState'];
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, vals.w, vals.h);
        return {'usedCache': true};
    }
    let xs = [];
    let ys = [];
    const stepVal = 0.2;
    let inValidRegion = false;
    for (let x = vals.xMin; x <= vals.xMax; x += stepVal) {
        const y = curve.y(x);
        if (!Number.isNaN(y) !== inValidRegion) {
            // fill in data near a discontinuity
            for (let xx = x-stepVal; xx < x; xx += stepVal / 8) {
                xs.push(xx);
                ys.push(curve.y(xx));
            }
            inValidRegion = !Number.isNaN(y);
        }
        xs.push(x);
        ys.push(curve.y(x));
    }

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawAxes(ctx, vals);
    let lastPoint = null;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = curveColor;
    ctx.lineWidth = 2;
    for (let i = xs.length - 1; i >= 0; i--) {
        if (!isNaN(ys[i])) {
            const p = pointToCtx(vals, xs[i], ys[i]);
            if (lastPoint) {
                ctx.lineTo(...p);
            } else if (ys[i] < 1) {
                // close the gap vertically
                ctx.moveTo(...pointToCtx(vals, xs[i], -ys[i]));
                ctx.lineTo(...p);
            } else {
                ctx.moveTo(...p);
            }
            lastPoint = p;
        } else {
            if (lastPoint) {
                // close the gap vertically
                const p = pointToCtx(vals, xs[i + 1], -ys[i + 1] );
                ctx.lineTo(...p);
            }
            lastPoint = null;
        }
    }
    lastPoint = null;
    for (let i = 0; i < xs.length; i++) {
        if (!isNaN(ys[i])) {
            const p = pointToCtx(vals, xs[i], -ys[i]);
            if (lastPoint) {
                ctx.lineTo(...p);
            } else {
                ctx.moveTo(...p);
            }
            lastPoint = p;
        } else {
            lastPoint = null;
        }
    }
    ctx.stroke();
    canvas.toBlob(blob => {
        let img = new Image();
        img.addEventListener('load', () => {
            ctx['_drawGraphSaveState'] = img;
        });
        img.src = URL.createObjectURL(blob);
    }, 'image/png');
    ctx.restore();
    return {'usedCache': false};
}

/**
 * Plot the nP values on the curve for the given n's
 * @param ctx {CanvasRenderingContext2D}
 * @param vals {Object} result from preCalcValues()
 * @param nVals {Array[Number]}
 */
function plotNPs(ctx, vals, ...nVals) {
    let P = curve.P();
    let Q = curve.P();
    let n = 1;
    let numSort = (a, b) => { return a - b };
    nVals.sort(numSort).forEach(nToPlot => {
        while (n < nToPlot) {
            Q = curve.add(P, Q);
            n++;
        }
        plotPoint(vals, nToPlot, Q);
    });
}

/**
 * @param ctx {CanvasRenderingContext2D}
 * @param func {Function}
 */
let setAnimationFrame = (ctx, func) => {
    if (ctx['_animationFrame']) {
        cancelAnimationFrame(ctx['_animationFrame']);
    }
    ctx['_animationFrame'] = func();
};

/**
 * @param ctx {CanvasRenderingContext2D}
 */
function cancelAddDemo(ctx) {
    if (ctx['_demoTimeout']) {
        clearTimeout(ctx['_demoTimeout']);
        ctx['_demoTimeout'] = null;
    }
    if (ctx['_animationFrame']) {
        cancelAnimationFrame(ctx['_animationFrame']);
        setAnimationFrame(ctx, () => { return null });
    }
}

/**
 * Return the x bounds of a line drawn through P and Q
 * @param vals {Object} result from preCalcValues()
 * @param P {Point}
 * @param Q {Point}
 * @return {Number[2]} x values of start and end of a line between P and Q
 */
function lineBoxBounds(vals, P, Q) {
    let xAtY = (P, m, y) => {
        let c = P.y - m * P.x;
        return (y - c) / m;
    };

    [P, Q] = common.orderPointsByX(P, Q);
    let lbound, hbound;
    const slope = curve.slope(P, Q);
    let left = P.y - P.x * slope;
    if (left >= vals.xMin && left <= vals.xMax) {
        lbound = vals.xMin;
    } else if (left < vals.xMin) {
        lbound = xAtY(P, slope, vals.yMin);
    } else {
        lbound = xAtY(P, slope, vals.yMax);
    }
    let right = P.y + (vals.xMax - P.x) * slope;
    if (right >= vals.xMin && right <= vals.xMax) {
        hbound = vals.xMax;
    } else if (right < vals.xMin) {
        hbound = xAtY(P, slope, vals.yMin);
    } else {
        hbound = xAtY(P, slope, vals.yMax);
    }
    return [lbound, hbound];
}

/**
 * Animate addition of P to the point Q to yield R.
 * @param ctx {CanvasRenderingContext2D}
 * @param n {Number} current n for point Q
 * @param Q {Point} previous point nP
 * @param drawDoneCb {Function} called when animation is complete
 * @return {Point} R such that P + Q = -R
 */
async function addP(ctx, n, Q, drawDoneCb) {
    const vals = preCalcValues(ctx);
    let start, prev;

    const P = curve.P();
    const R = curve.add(P, Q);
    const negR = curve.negate(R);
    const slope = curve.slope(P, Q);

    const started = {};
    const finished = {};
    const duration = {
        tangent: 500,
        tanPause: 300,
        line: 500,
        linePause: 500,
        negate: 1000,
        done: 1000,
    };
    const cache = {};

    let markState = (state, timestamp) => {
        started[state] = started[state] || timestamp;
        return timestamp - started[state];
    };

    async function step(timestamp) {
        if (!start) {
            start = timestamp;
        }
        if (timestamp !== prev) {
            ctx.beginPath();
            ctx.save();
            if (!finished['tangent']) {
                let instate = markState('tangent', timestamp);
                ctx.beginPath();
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'orange';
                ctx.setLineDash([4, 4]);
                let mult = instate / duration.tangent;
                mult = common.easeInOut(mult);
                let bounds = lineBoxBounds(vals, P, Q);
                let tanLineForw = bounds[1] - P.x;
                let tanLineBack = P.x - bounds[0];
                tanLineForw *= mult;
                tanLineBack *= mult;
                ctx.moveTo(...pointToCtx(vals, P.x, P.y));
                ctx.lineTo(...pointToCtx(vals, P.x + Math.abs(tanLineForw),
                    P.y + tanLineForw * slope));
                ctx.moveTo(...pointToCtx(vals, P.x, P.y));
                ctx.lineTo(...pointToCtx(vals, P.x - Math.abs(tanLineBack),
                    P.y - tanLineBack * slope));
                ctx.stroke();
                drawDot(vals, P.x, P.y, curveColor);
                drawDot(vals, Q.x, Q.y, 'orange');
                if (instate > duration.tangent) {
                    finished.tangent = timestamp;
                }
            } else if (!finished.tanPause) {
                let instate = markState('tanPause', timestamp);
                if (instate > duration.tanPause) {
                    finished.tanPause = timestamp;
                }
            } else if (!finished.line) {
                let instate = markState('line', timestamp);
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'orange';
                ctx.setLineDash([]);
                let mult = instate / duration.line;
                mult = Math.min(1.0, mult);
                mult = common.easeInOut(mult);
                ctx.moveTo(...pointToCtx(vals, P.x, P.y));
                const dest = {x: P.x + mult * (negR.x - P.x), y: P.y + mult * (negR.y - P.y)};
                ctx.lineTo(...pointToCtx(vals, dest.x, dest.y));
                ctx.stroke();
                drawDot(vals, P.x, P.y, curveColor);
                drawDot(vals, Q.x, Q.y, 'orange');
                if (instate >= duration.line) {
                    finished.line = timestamp;
                    drawDot(vals, negR.x, negR.y, 'red');
                }
            } else if (!finished.linePause) {
                let instate = markState('linePause', timestamp);
                if (instate >= duration.linePause) {
                    finished.linePause = timestamp;
                }
            } else if (!finished.negate) {
                let instate = markState('negate', timestamp);
                ctx.beginPath();
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'red';
                ctx.setLineDash([3, 2]);
                if (!cache.negLeg) {
                    cache.negLeg = negR.y - R.y;
                }
                let mult = instate / duration.negate;
                mult = Math.min(1, mult);
                mult = common.easeInOut(mult);
                ctx.moveTo(...pointToCtx(vals, negR.x, negR.y, true));
                ctx.lineTo(...pointToCtx(vals, negR.x, negR.y - cache.negLeg * mult, true));
                ctx.stroke();
                ctx.setLineDash([]);
                // overdraw to fix red line covering this dot
                drawDot(vals, negR.x, negR.y, 'red');
                if (instate > duration.negate) {
                    ctx.strokeStyle = 'black';
                    drawDot(vals, Q.x, Q.y, 'orange');
                    plotNPs(ctx, vals, n+1);
                    finished.negate = timestamp;
                }
            } else if (!finished.done) {
                let instate = markState('done', timestamp);
                if (instate > duration.done) {
                    finished.done = timestamp;
                }
            }
            ctx.restore();
        }
        prev = timestamp;

        if (finished.done) {
            if (drawDoneCb) drawDoneCb(n+1, R);
        } else {
            setAnimationFrame(ctx, () => { return requestAnimationFrame(step) });
        }
    }
    setAnimationFrame(ctx, () => { return requestAnimationFrame(step) });
    return R;
}

/**
 * @param ctx {CanvasRenderingContext2D}
 * @param n {Number} the current scalar multiplication we're displaying
 * @param Q {Point} the point nP that we're currently on
 * @param updateCb {Function?} called when n is updated
 * @param drawDoneCb {Function?} called when each animation is finished
 */
async function runAddDemo(ctx, n, Q, updateCb, drawDoneCb) {
    cancelAddDemo(ctx);
    const vals = preCalcValues(ctx);
    Q = Q || curve.P();
    let next = async () => {
        await drawCurve(ctx);
        plotNPs(ctx, vals, ...common.range(1, n));
        Q = await addP(ctx, n, Q, (n, R) => {
            if (drawDoneCb) drawDoneCb(n, R);
            if (common.canvasIsScrolledIntoView(ctx.canvas)) {
                ctx['_demoTimeout'] = setTimeout(next, .5 * 1000);
            } else {
                cancelAddDemo(ctx);
                common.addPlayMask(ctx, () => {
                    runAddDemo(ctx, n, Q, updateCb, drawDoneCb);
                });
            }
        });
        n++;
        const wrapAt = 8;
        if (n >= wrapAt) {
            n = 1;
            Q = curve.P();
        }
        if (updateCb) updateCb(n, Q);
    };
    await next();
}

export {
    drawCurve,
    plotNPs,
    cancelAddDemo,
    runAddDemo,
};