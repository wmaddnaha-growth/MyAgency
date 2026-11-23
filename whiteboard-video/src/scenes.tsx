import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {
	AMIRI, Draw, DrawSeq, GOLD, INK, Man, Questions, RUQAA, SOFT, STAGE_H, STAGE_W, Saqia, Write,
	circle, ellipse, rect, usePop, useProg,
} from './kit';

const Stage: React.FC<{svg: React.ReactNode; children?: React.ReactNode}> = ({svg, children}) => (
	<div style={{position: 'relative', width: STAGE_W, height: STAGE_H}}>
		<svg viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} width={STAGE_W} height={STAGE_H} style={{position: 'absolute', inset: 0}}>
			{svg}
		</svg>
		{children}
	</div>
);

/* ---------- small icons ---------- */
const bubble = (x: number, y: number, w: number, h: number) =>
	`M ${x + 20} ${y} L ${x + w - 20} ${y} Q ${x + w} ${y} ${x + w} ${y + 20} L ${x + w} ${y + h - 20} Q ${x + w} ${y + h} ${x + w - 20} ${y + h} L ${x + w * 0.35} ${y + h} L ${x + w * 0.2} ${y + h + 26} L ${x + w * 0.24} ${y + h} L ${x + 20} ${y + h} Q ${x} ${y + h} ${x} ${y + h - 20} L ${x} ${y + 20} Q ${x} ${y} ${x + 20} ${y} Z`;
/** closed cloud: bumps around an ellipse */
const cloud = (cx: number, cy: number, w: number, h: number, n = 12) => {
	const rx = w / 2 - 20, ry = h / 2 - 20;
	const pt = (i: number, k = 1) => {
		const a = (i / n) * Math.PI * 2;
		return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
	};
	let d = `M ${pt(0)[0]} ${pt(0)[1]}`;
	for (let i = 0; i < n; i++) {
		const c = pt(i + 0.5, 1.28);
		const e = pt(i + 1);
		d += ` Q ${c[0]} ${c[1]} ${e[0]} ${e[1]}`;
	}
	return d + ' Z';
};
const calendar = (x: number, y: number, w: number, h: number) => [
	rect(x, y, w, h),
	`M ${x} ${y + h * 0.22} L ${x + w} ${y + h * 0.22}`,
	`M ${x + w * 0.28} ${y - 14} L ${x + w * 0.28} ${y + 14}`,
	`M ${x + w * 0.72} ${y - 14} L ${x + w * 0.72} ${y + 14}`,
	...[1, 2, 3].map((i) => `M ${x + (w * i) / 4} ${y + h * 0.22} L ${x + (w * i) / 4} ${y + h}`),
	...[1, 2].map((i) => `M ${x} ${y + h * 0.22 + ((h * 0.78) * i) / 3} L ${x + w} ${y + h * 0.22 + ((h * 0.78) * i) / 3}`),
];
const mat = (x: number, y: number, w: number) =>
	`M ${x} ${y} L ${x + w} ${y} L ${x + w - 40} ${y + 34} L ${x - 40} ${y + 34} Z`;
const key = (x: number, y: number, s = 1) =>
	`${circle(x, y, 14 * s)} M ${x + 14 * s} ${y} L ${x + 62 * s} ${y} M ${x + 48 * s} ${y} L ${x + 48 * s} ${y + 14 * s} M ${x + 60 * s} ${y} L ${x + 60 * s} ${y + 12 * s}`;

/* ================= SCENE 1 — HOOK (120f) ================= */
export const S1: React.FC = () => {
	const f = useCurrentFrame();
	const t = Math.max(0, f - 30) / 22;
	const cx = 540, gy = 905;
	const mx = cx + Math.cos(t) * 330, my = gy + Math.sin(t) * 70;
	const behind = Math.sin(t) < 0;
	return (
		<Stage
			svg={
				<>
					<Saqia cx={cx} cy={560} r={210} from={6} />
					<Man x={mx} y={my} s={behind ? 0.72 : 0.85} walk from={26} each={3} mood="sad" opacity={behind ? 0.45 : 1} />
				</>
			}
		>
			<Write text="أنا مين؟ وعايش ليه؟" from={0} dur={34} y={40} size={92} />
			<Questions x={mx} y={my - 210} from={48} scale={0.8} />
		</Stage>
	);
};

/* ================= SCENE 2 — CHARACTER (240f) ================= */
export const S2: React.FC = () => {
	const f = useCurrentFrame();
	// (a) phone + word bubble, right panel
	const bx = interpolate(f, [12, 40], [1150, 840], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	// (c) calendar pages flipping
	const flip = (f - 130) % 18;
	return (
		<Stage
			svg={
				<>
					{/* panel separators */}
					<Draw d="M 720 330 L 720 980" from={0} dur={14} color={SOFT} w={3} />
					<Draw d="M 360 330 L 360 980" from={0} dur={14} color={SOFT} w={3} />
					{/* (a) right */}
					<Man x={900} y={880} s={0.9} mood={f > 44 ? 'sad' : 'smile'} from={2} each={3} armR={[46, -170]} />
					<Draw d={rect(930, 690, 30, 52)} from={22} dur={8} />
					{f > 12 && f < 48 && <Draw d={bubble(bx - 90, 470, 150, 90)} from={12} dur={10} />}
					{f >= 48 && <Draw d={bubble(830, 470, 150, 90)} from={0} dur={1} color={INK} />}
					{f > 22 && <Draw d={`M ${bx - 60} 515 l 90 0 M ${bx - 60} 535 l 60 0`} from={22} dur={6} w={5} />}
					{/* (b) middle: prayer, side view */}
					<Draw d={mat(470, 880, 150)} from={50} dur={14} color={GOLD} w={6} />
					<Man x={540} y={880} s={0.9} mood="none" from={52} each={3} armL={[10, -95]} armR={[16, -98]} />
					<Draw d={cloud(470, 450, 210, 150)} from={70} dur={20} w={5} />
					<Draw d={`${circle(560, 640, 9)} ${circle(530, 590, 13)}`} from={66} dur={8} w={5} />
					<Draw d={`${rect(420, 425, 100, 62)} M 405 495 L 535 495`} from={86} dur={14} w={5} />
					<Draw d={`${rect(395, 395, 55, 36)} M 395 395 L 422 415 L 450 395`} from={94} dur={10} w={4} />
					{/* (c) left: calendar + sticky note */}
					<DrawSeq paths={calendar(60, 560, 240, 230)} from={124} each={3} w={5} />
					<Draw d={rect(200, 520, 110, 100)} from={146} dur={10} color={GOLD} w={6} />
					{f > 156 && (
						<g opacity={interpolate(flip, [0, 18], [1, 0])} transform={`translate(0 ${-flip * 9})`}>
							<path d={rect(60, 560, 240, 230)} fill="none" stroke={INK} strokeWidth={4} />
						</g>
					)}
				</>
			}
		>
			<Write text="كلمة بتبوّظ يومك" from={30} dur={22} x={725} w={350} y={1010} size={46} />
			<Write text={'صلاة ودماغك\nفي حتة تانية'} from={76} dur={24} x={365} w={350} y={990} size={46} lineHeight={1.35} />
			<Write text="من أول الشهر" from={150} dur={22} x={5} w={350} y={1010} size={46} />
		</Stage>
	);
};

/* ================= SCENE 3 — PROBLEM (240f) ================= */
export const S3: React.FC = () => {
	const f = useCurrentFrame();
	const cx = 540, cy = 470, r = 230;
	const ang = (f * 0.9 * Math.PI) / 180;
	const icon = (i: number) => {
		const a = ang + (i * 2 * Math.PI) / 3 - Math.PI / 2;
		return {x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r};
	};
	const p0 = icon(0), p1 = icon(1), p2 = icon(2);
	const days = Array.from({length: 7}, (_, i) => i);
	return (
		<Stage
			svg={
				<>
					<Saqia cx={cx} cy={cy} r={r} from={0} track={false} />
					{f > 40 && (
						<>
							<path d={bubble(p0.x - 45, p0.y - 30, 90, 56)} fill="#fff" stroke={INK} strokeWidth={5} />
							<path d={mat(p1.x - 40, p1.y - 12, 80)} fill="#fff" stroke={GOLD} strokeWidth={5} />
							<path d={rect(p2.x - 34, p2.y - 30, 68, 60)} fill="#fff" stroke={INK} strokeWidth={5} />
						</>
					)}
					{days.map((i) => {
						const x = 945 - i * 135, y = 860;
						const from = 70 + i * 16;
						return (
							<g key={i}>
								<Draw d={rect(x - 55, y, 110, 110)} from={from} dur={8} w={5} />
								<Draw d={`M ${x - 22} ${y + 78} Q ${x} ${y + 62} ${x + 22} ${y + 78} M ${x - 18} ${y + 42} l .1 0 M ${x + 18} ${y + 42} l .1 0`} from={from + 6} dur={6} w={6} />
							</g>
						);
					})}
				</>
			}
		>
			<Write text="كل يوم زي اللي قبله" from={10} dur={30} y={40} size={88} />
		</Stage>
	);
};

/* ================= SCENE 4 — INSIDE (210f) ================= */
export const S4: React.FC = () => {
	const grow = interpolate(useCurrentFrame(), [150, 250], [0.8, 1.25], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<Stage
			svg={
				<>
					<Draw d={rect(300, 280, 480, 480)} from={0} dur={20} w={8} />
					<Draw d="M 540 280 L 540 760 M 300 520 L 780 520" from={16} dur={14} w={6} />
					<Draw d="M 700 340 a 44 44 0 1 0 30 76 a 34 34 0 1 1 -30 -76 Z" from={30} dur={14} color={GOLD} w={5} />
					<Draw d="M 380 360 l 0.1 0 M 460 420 l .1 0 M 610 600 l .1 0 M 420 660 l .1 0 M 690 690 l .1 0" from={40} dur={10} w={9} />
					<Man x={540} y={1080} s={1.05} mood="none" from={44} each={4} armL={[-40, -80]} armR={[40, -80]} />
					<Draw d={`${rect(552, 945, 34, 26)} M 552 958 L 586 958`} from={80} dur={10} w={5} />
				</>
			}
		>
			<Write text="إيه الهدف أصلًا؟" from={150} dur={30} y={40} size={92} />
			<Questions x={540} y={690} from={150} scale={grow} />
		</Stage>
	);
};

/* ================= SCENE 5 — VILLAIN (180f) ================= */
export const S5: React.FC = () => {
	const words = ['خاطرة', 'فكرة', 'شعور', 'سلوك', 'عادة'];
	return (
		<Stage
			svg={
				<>
					<Man x={900} y={1080} s={0.7} mood="flat" from={0} each={3} />
					<Draw d={`${circle(860, 900, 12)} ${circle(820, 850, 18)}`} from={14} dur={10} w={5} />
					<Draw d={cloud(540, 560, 1000, 420)} from={20} dur={26} w={6} />
					{words.map((w, i) => {
						const x = 880 - i * 185;
						const from = 46 + i * 20;
						return (
							<g key={w}>
								<Draw d={rect(x - 75, 515, 150, 90)} from={from} dur={10} w={6} color={i === 0 ? GOLD : INK} />
								{i < 4 && <Draw d={`M ${x - 82} 560 L ${x - 105} 560 M ${x - 95} 550 L ${x - 105} 560 L ${x - 95} 570`} from={from + 10} dur={6} w={5} />}
							</g>
						);
					})}
					<Draw d="M 140 610 Q 140 760 200 840" from={112} dur={12} w={5} />
					<Saqia cx={260} cy={950} r={90} from={118} track={false} />
				</>
			}
		>
			{words.map((w, i) => (
				<Write key={w} text={w} from={52 + i * 20} dur={10} x={880 - i * 185 - 75} w={150} y={522} size={46} color={i === 0 ? GOLD : INK} />
			))}
		</Stage>
	);
};

/* ================= SCENE 6 — GUIDE (240f) ================= */
export const S6: React.FC = () => {
	const f = useCurrentFrame();
	const qFade = interpolate(f, [24, 48], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const qScale = interpolate(f, [24, 48], [1, 2.2], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const pop1 = usePop(150), pop2 = usePop(170);
	return (
		<Stage
			svg={
				<>
					<Draw d={rect(330, 250, 420, 560)} from={40} dur={22} color={GOLD} w={9} />
					<Draw d={rect(355, 275, 370, 510)} from={56} dur={18} color={GOLD} w={3} />
					<Draw d="M 330 250 L 300 270 L 300 830 L 330 810" from={62} dur={12} color={GOLD} w={6} />
					<g transform={`translate(840 520) scale(${pop1}) translate(-840 -520)`}>
						<path d={rect(800, 450, 110, 140)} fill="none" stroke={INK} strokeWidth={5} />
						{[0, 1, 2].map((i) => (
							<path key={i} d={`M 815 ${485 + i * 36} l 10 10 l 18 -20 M 855 ${490 + i * 36} l 40 0`} fill="none" stroke={GOLD} strokeWidth={5} strokeLinecap="round" />
						))}
					</g>
					<g transform={`translate(200 560) scale(${pop2}) translate(-200 -560)`}>
						<path d={rect(150, 500, 110, 140)} fill="none" stroke={INK} strokeWidth={5} />
						<path d={`${circle(190, 550, 34)} M 214 574 L 252 612`} fill="none" stroke={GOLD} strokeWidth={7} strokeLinecap="round" />
					</g>
				</>
			}
		>
			<div
				style={{position: 'absolute', left: 0, right: 0, top: 380, textAlign: 'center', fontFamily: AMIRI, fontWeight: 700, color: GOLD,
					fontSize: 150, opacity: qFade, transform: `scale(${qScale})`}}
			>
				؟ ؟
			</div>
			<Write text={'من أنا…\nوِلَم أنا؟'} from={80} dur={40} x={340} w={400} y={400} size={86} color={GOLD} font={RUQAA} lineHeight={1.6} />
		</Stage>
	);
};

/* ================= SCENE 7 — PLAN (210f) ================= */
export const S7: React.FC = () => {
	const f = useCurrentFrame();
	const steps = [
		{x: 760, y: 900, label: 'اطلب'},
		{x: 500, y: 760, label: 'ابدأ من فصلك'},
		{x: 240, y: 620, label: 'امشي 30 يوم'},
	];
	const stair = 'M 1000 1040 L 1000 900 L 630 900 L 630 760 L 370 760 L 370 620 L 110 620 L 110 1040 Z';
	const ticks = Math.floor(interpolate(f, [150, 235], [0, 30], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
	const manStep = f < 70 ? 0 : f < 115 ? 1 : 2;
	const ms = steps[manStep];
	return (
		<Stage
			svg={
				<>
					<Draw d={stair} from={0} dur={30} w={7} />
					{steps.map((s, i) => (
						<Draw key={i} d={circle(s.x, s.y + 42, 26)} from={20 + i * 12} dur={10} color={GOLD} w={5} />
					))}
					<Man x={ms.x + 70} y={ms.y} s={0.6} mood="smile" from={0} each={2} />
					{/* fridge sheet grid on top step */}
					<Draw d={rect(130, 300, 360, 150)} from={140} dur={12} w={5} />
					{Array.from({length: 30}, (_, i) => {
						const col = i % 10, row = Math.floor(i / 10);
						const x = 455 - col * 34, y = 318 + row * 40;
						return (
							<g key={i}>
								<rect x={x - 12} y={y} width={26} height={26} fill={i < ticks ? GOLD : 'none'} stroke={f > 144 ? INK : 'none'} strokeWidth={2} />
							</g>
						);
					})}
				</>
			}
		>
			{steps.map((s, i) => (
				<React.Fragment key={i}>
					<Write text={String(i + 1)} from={26 + i * 12} dur={6} x={s.x - 40} w={80} y={s.y + 12} size={36} color={GOLD} />
					<Write text={s.label} from={34 + i * 40} dur={18} x={s.x - 130} w={260} y={s.y + 72} size={38} lineHeight={1.3} />
				</React.Fragment>
			))}
		</Stage>
	);
};

/* ================= SCENE 8 — FAILURE vs SUCCESS (210f) ================= */
export const S8: React.FC = () => {
	const f = useCurrentFrame();
	const walkY = interpolate(f, [30, 210], [1020, 820], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const walkS = interpolate(f, [30, 210], [0.85, 0.55], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const sun = usePop(20);
	return (
		<Stage
			svg={
				<>
					<Draw d="M 540 250 L 540 1090" from={0} dur={14} color={SOFT} w={3} />
					{/* left: saqia keeps turning */}
					<Saqia cx={270} cy={560} r={150} from={4} speed={1.4} track={false} />
					{[0, 1, 2, 3].map((i) => (
						<Draw key={i} d={rect(70 + i * 105, 900, 85, 85)} from={40 + i * 14} dur={8} w={5} />
					))}
					{/* right: road to sunrise */}
					<Draw d="M 600 1090 L 790 640 M 1040 1090 L 830 640" from={10} dur={20} w={6} />
					<g transform={`translate(810 610) scale(${sun}) translate(-810 -610)`}>
						<path d="M 730 640 A 80 80 0 0 1 890 640" fill="none" stroke={GOLD} strokeWidth={8} />
						{[-60, -30, 0, 30, 60].map((a) => {
							const rad = ((a - 90) * Math.PI) / 180;
							return <path key={a} d={`M ${810 + Math.cos(rad) * 100} ${640 + Math.sin(rad) * 100} L ${810 + Math.cos(rad) * 135} ${640 + Math.sin(rad) * 135}`} stroke={GOLD} strokeWidth={6} strokeLinecap="round" />;
						})}
					</g>
					<Man x={815} y={walkY} s={walkS} mood="smile" walk from={24} each={3} armR={[50, -120]} />
					<Draw d={key(815 + 50 * walkS, walkY - 120 * walkS, walkS * 1.2)} from={50} dur={12} color={GOLD} w={6} />
				</>
			}
		>
			<Write text={'من عايش وخلاص\nلعارف أنا عايش ليه'} from={118} dur={50} y={40} size={72} lineHeight={1.45} />
		</Stage>
	);
};

/* ================= SCENE 9 — CTA (150f) ================= */
export const S9: React.FC = () => {
	const shield = usePop(120);
	return (
		<Stage
			svg={
				<>
					<Draw d="M 260 260 L 760 260 L 900 430 L 760 600 L 260 600 Z" from={0} dur={24} w={8} />
					<Draw d={circle(800, 430, 22)} from={20} dur={8} w={6} />
					<Draw d="M 300 350 L 520 330" from={44} dur={8} color="#A8402F" w={8} />
					<g transform={`translate(540 820) scale(${shield}) translate(-540 -820)`}>
						<path d="M 540 700 L 650 740 L 640 860 Q 600 930 540 960 Q 480 930 440 860 L 430 740 Z" fill="none" stroke={GOLD} strokeWidth={8} strokeLinejoin="round" />
					</g>
				</>
			}
		>
			<Write text="499ج" from={24} dur={14} x={290} w={240} y={290} size={70} color={INK} />
			<Write text="299ج" from={54} dur={16} x={290} w={420} y={390} size={150} color={GOLD} lineHeight={1.2} />
			<div style={{position: 'absolute', left: 0, right: 0, top: 745, textAlign: 'center', fontFamily: AMIRI, fontWeight: 700, color: GOLD, fontSize: 120, transform: `scale(${shield})`}}>7</div>
			<Write text="ضمان 7 أيام تطبيق" from={130} dur={30} y={985} size={70} />
		</Stage>
	);
};

export const SCENES: {C: React.FC; dur: number}[] = [
	// durations follow the voice-over in public/vo.mp3 (total 2145 frames = 71.5s)
	{C: S1, dur: 187},
	{C: S2, dur: 222},
	{C: S3, dur: 197},
	{C: S4, dur: 261},
	{C: S5, dur: 219},
	{C: S6, dur: 326},
	{C: S7, dur: 245},
	{C: S8, dur: 214},
	{C: S9, dur: 274},
];

export {ellipse};
