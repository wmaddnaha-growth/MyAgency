import React from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {evolvePath} from '@remotion/paths';
import {loadFont as loadAmiri} from '@remotion/google-fonts/Amiri';
import {loadFont as loadReadex} from '@remotion/google-fonts/ReadexPro';
import {loadFont as loadRuqaa} from '@remotion/google-fonts/ArefRuqaa';

export const AMIRI = loadAmiri('normal', {weights: ['700'], subsets: ['arabic']}).fontFamily;
export const READEX = loadReadex('normal', {weights: ['500', '700'], subsets: ['arabic', 'latin']}).fontFamily;
export const RUQAA = loadRuqaa('normal', {weights: ['700'], subsets: ['arabic']}).fontFamily;

export const INK = '#1C1A17';
export const GOLD = '#9A7432';
export const SOFT = '#8C857A';
export const STAGE_W = 1080;
export const STAGE_H = 1130;

/** progress 0..1 between two local frames */
export const useProg = (from: number, dur: number) => {
	const f = useCurrentFrame();
	return interpolate(f, [from, from + dur], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.inOut(Easing.quad),
	});
};

/** A stroke that draws itself like a marker */
export const Draw: React.FC<{
	d: string;
	from: number;
	dur: number;
	color?: string;
	w?: number;
	opacity?: number;
}> = ({d, from, dur, color = INK, w = 7, opacity = 1}) => {
	const p = useProg(from, dur);
	if (p <= 0) return null;
	const {strokeDasharray, strokeDashoffset} = evolvePath(p, d);
	return (
		<path
			d={d}
			fill="none"
			stroke={color}
			strokeWidth={w}
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeDasharray={strokeDasharray}
			strokeDashoffset={strokeDashoffset}
			opacity={opacity}
		/>
	);
};

/** Several strokes drawn one after the other */
export const DrawSeq: React.FC<{
	paths: string[];
	from: number;
	each: number;
	color?: string;
	w?: number;
}> = ({paths, from, each, color, w}) => (
	<>
		{paths.map((d, i) => (
			<Draw key={i} d={d} from={from + i * each} dur={each} color={color} w={w} />
		))}
	</>
);

/** Arabic text revealed right-to-left like handwriting */
export const Write: React.FC<{
	text: string;
	from: number;
	dur: number;
	x?: number;
	y: number;
	w?: number;
	size?: number;
	color?: string;
	font?: string;
	lineHeight?: number;
}> = ({text, from, dur, x = 40, y, w = STAGE_W - 80, size = 78, color = INK, font = AMIRI, lineHeight = 1.5}) => {
	const p = useProg(from, dur);
	if (p <= 0) return null;
	return (
		<div
			style={{
				position: 'absolute',
				left: x,
				top: y,
				width: w,
				direction: 'rtl',
				textAlign: 'center',
				fontFamily: font,
				fontWeight: 700,
				fontSize: size,
				lineHeight,
				color,
				whiteSpace: 'pre-line',
				clipPath: `inset(-30% 0 -30% ${(1 - p) * 100}%)`,
			}}
		>
			{text}
		</div>
	);
};

/** Springy pop-in scale for an SVG group */
export const usePop = (from: number) => {
	const f = useCurrentFrame();
	const {fps} = useVideoConfig();
	return spring({frame: f - from, fps, config: {damping: 11, stiffness: 140}});
};

export const circle = (cx: number, cy: number, r: number) =>
	`M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;

export const rect = (x: number, y: number, w: number, h: number) =>
	`M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;

export const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
	`M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

/** Stick-figure man, feet at (x, y). s = scale. */
export const manPaths = (
	x: number,
	y: number,
	s = 1,
	o: {mood?: 'sad' | 'flat' | 'smile' | 'none'; walk?: number; armL?: [number, number]; armR?: [number, number]} = {}
) => {
	const k = (v: number) => v * s;
	const head = {cx: x, cy: y - k(190), r: k(34)};
	const neck = y - k(156);
	const hip = y - k(70);
	const sw = o.walk ?? 0;
	const aL = o.armL ?? [-48, -95];
	const aR = o.armR ?? [48, -95];
	const p: string[] = [
		circle(head.cx, head.cy, head.r),
		`M ${x} ${neck} L ${x} ${hip}`,
		`M ${x} ${hip} L ${x - k(28) + k(sw)} ${y}`,
		`M ${x} ${hip} L ${x + k(28) - k(sw)} ${y}`,
		`M ${x} ${y - k(135)} L ${x + k(aL[0])} ${y + k(aL[1])}`,
		`M ${x} ${y - k(135)} L ${x + k(aR[0])} ${y + k(aR[1])}`,
	];
	const ex = k(11), ey = head.cy - k(6);
	if (o.mood !== 'none') {
		p.push(`M ${x - ex} ${ey} l 0.1 0`, `M ${x + ex} ${ey} l 0.1 0`);
		const my = head.cy + k(14);
		if (o.mood === 'sad') p.push(`M ${x - k(12)} ${my + k(5)} Q ${x} ${my - k(6)} ${x + k(12)} ${my + k(5)}`);
		else if (o.mood === 'smile') p.push(`M ${x - k(13)} ${my - k(3)} Q ${x} ${my + k(10)} ${x + k(13)} ${my - k(3)}`);
		else p.push(`M ${x - k(11)} ${my} L ${x + k(11)} ${my}`);
	}
	return p;
};

/** A man that is fully drawn (no reveal) – used while he moves */
export const Man: React.FC<{
	x: number;
	y: number;
	s?: number;
	mood?: 'sad' | 'flat' | 'smile' | 'none';
	walk?: boolean;
	from?: number;
	each?: number;
	armL?: [number, number];
	armR?: [number, number];
	opacity?: number;
}> = ({x, y, s = 1, mood = 'flat', walk = false, from = 0, each = 5, armL, armR, opacity = 1}) => {
	const f = useCurrentFrame();
	const sw = walk ? Math.sin(f / 3.2) * 18 : 0;
	const paths = manPaths(x, y, s, {mood, walk: sw, armL, armR});
	return (
		<g opacity={opacity}>
			{paths.map((d, i) => (
				<Draw key={i} d={d} from={from + i * each} dur={each + 2} w={7 * Math.max(0.7, s)} />
			))}
		</g>
	);
};

/** Saqia (water wheel) with turning spokes and pots, plus the worn walking track */
export const Saqia: React.FC<{cx: number; cy: number; r: number; from: number; speed?: number; track?: boolean}> = ({
	cx,
	cy,
	r,
	from,
	speed = 0.9,
	track = true,
}) => {
	const f = useCurrentFrame();
	const ang = Math.max(0, f - from) * speed;
	const spokes = Array.from({length: 8}, (_, i) => {
		const a = (i * Math.PI) / 4;
		return `M ${cx} ${cy} L ${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}`;
	});
	const pots = Array.from({length: 12}, (_, i) => {
		const a = (i * Math.PI) / 6;
		const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
		return `M ${px - 13} ${py - 4} Q ${px} ${py + 22} ${px + 13} ${py - 4} Z`;
	});
	const ground = cy + r + 30;
	return (
		<g>
			{track && (
				<>
					<Draw d={ellipse(cx, ground + 70, r + 170, 85)} from={from} dur={18} color={SOFT} w={12} />
					<Draw d={ellipse(cx, ground + 70, r + 150, 70)} from={from + 6} dur={18} color={SOFT} w={4} />
				</>
			)}
			<Draw d={`M ${cx - 20} ${ground + 70} L ${cx} ${cy} L ${cx + 20} ${ground + 70}`} from={from + 8} dur={12} />
			<g transform={`rotate(${ang} ${cx} ${cy})`}>
				<Draw d={circle(cx, cy, r)} from={from + 10} dur={18} />
				<Draw d={circle(cx, cy, r * 0.32)} from={from + 18} dur={10} />
				{spokes.map((d, i) => (
					<Draw key={i} d={d} from={from + 20 + i * 1.5} dur={6} w={5} />
				))}
				{pots.map((d, i) => (
					<Draw key={'p' + i} d={d} from={from + 26 + i} dur={6} w={5} />
				))}
			</g>
		</g>
	);
};

/** Gold Arabic question marks above a head */
export const Questions: React.FC<{x: number; y: number; from: number; scale?: number; opacity?: number}> = ({
	x,
	y,
	from,
	scale = 1,
	opacity = 1,
}) => {
	const a = usePop(from);
	const b = usePop(from + 8);
	const f = useCurrentFrame();
	const bob = Math.sin(f / 9) * 6;
	const st = (v: number): React.CSSProperties => ({
		position: 'absolute',
		fontFamily: AMIRI,
		fontWeight: 700,
		color: GOLD,
		fontSize: 150 * scale,
		lineHeight: 1,
		transform: `scale(${v})`,
		opacity,
	});
	return (
		<>
			<div style={{...st(a), left: x - 120 * scale, top: y - 150 * scale + bob}}>؟</div>
			<div style={{...st(b), left: x + 20 * scale, top: y - 190 * scale - bob}}>؟</div>
		</>
	);
};
