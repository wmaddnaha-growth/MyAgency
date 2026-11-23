import React from 'react';
import {AbsoluteFill, Sequence, interpolate, useCurrentFrame} from 'remotion';
import {AMIRI, READEX, Draw, Man, Questions, Write, circle, usePop} from './kit';

/* Shared palette for the "شفرة الرجالة" ad (see campaigns/شفرة-الرجالة/brand.md) */
const MAROON = '#5A1B2C';
const GOLD = '#9A7432';
const INK = '#1A1612';
const PAPER = '#FBF7F0';
const SOFT = '#8C857A';
const RED = '#A8402F';
const GREEN = '#2E7D4F';

const W = 1080;
const H = 1920;

/* ---------- local shapes ---------- */
const bubble = (x: number, y: number, w: number, h: number) =>
	`M ${x + 20} ${y} L ${x + w - 20} ${y} Q ${x + w} ${y} ${x + w} ${y + 20} L ${x + w} ${y + h - 20} Q ${x + w} ${y + h} ${x + w - 20} ${y + h} L ${x + w * 0.35} ${y + h} L ${x + w * 0.2} ${y + h + 26} L ${x + w * 0.24} ${y + h} L ${x + 20} ${y + h} Q ${x} ${y + h} ${x} ${y + h - 20} L ${x} ${y + 20} Q ${x} ${y} ${x + 20} ${y} Z`;

const shield = (cx: number, cy: number) =>
	`M ${cx} ${cy - 120} L ${cx + 110} ${cy - 80} L ${cx + 100} ${cy + 40} Q ${cx + 60} ${cy + 110} ${cx} ${cy + 140} Q ${cx - 60} ${cy + 110} ${cx - 100} ${cy + 40} L ${cx - 110} ${cy - 80} Z`;

const arrowDown = (x: number, y: number, len: number) =>
	`M ${x} ${y} L ${x} ${y + len} M ${x - 34} ${y + len - 34} L ${x} ${y + len} L ${x + 34} ${y + len - 34}`;

const xMark = (x: number, y: number, s: number) =>
	`M ${x - s} ${y - s} L ${x + s} ${y + s} M ${x + s} ${y - s} L ${x - s} ${y + s}`;

const tick = (x: number, y: number, s: number) =>
	`M ${x - s} ${y} L ${x - s * 0.25} ${y + s * 0.8} L ${x + s} ${y - s * 0.8}`;

/* ---------- SCENE 1 — الهوك: جوزك قاعد جنبك ---------- */
export const RS1: React.FC = () => (
	<AbsoluteFill>
		<Write text={'جوزك قاعد جنبك..\nوحاسة إنه بعيد؟'} from={0} dur={30} y={260} size={92} color={MAROON} lineHeight={1.45} />
		<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{position: 'absolute', inset: 0}}>
			<Man x={330} y={1260} s={1.1} mood="flat" from={20} each={4} />
			<Man x={750} y={1260} s={1.1} mood="flat" from={34} each={4} />
			<Draw d={`M 540 1000 L 540 1220`} from={60} dur={20} color={SOFT} w={6} />
		</svg>
		<Questions x={540} y={930} from={60} scale={0.9} />
	</AbsoluteFill>
);

/* ---------- SCENE 2 — مش خناقة.. ومش نيو لوك ---------- */
export const RS2: React.FC = () => (
	<AbsoluteFill>
		<Write text="مش خناقة.." from={0} dur={20} y={380} size={88} color={INK} />
		<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{position: 'absolute', inset: 0}}>
			<Draw d={xMark(540, 470, 150)} from={24} dur={14} color={RED} w={14} />
		</svg>
		<Write text="ومش نيو لوك" from={50} dur={20} y={760} size={88} color={INK} />
		<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{position: 'absolute', inset: 0}}>
			<Draw d={xMark(540, 850, 150)} from={80} dur={14} color={RED} w={14} />
		</svg>
		<Write text="الحل الحقيقي: فهم" from={112} dur={22} y={1160} size={92} color={MAROON} />
		<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{position: 'absolute', inset: 0}}>
			<Draw d={tick(540, 1330, 90)} from={140} dur={14} color={GREEN} w={16} />
		</svg>
	</AbsoluteFill>
);

/* ---------- SCENE 3 — الراجل بيتكلم.. بس مش دايمًا بالكلام ---------- */
export const RS3: React.FC = () => {
	const dots = [0, 1, 2];
	return (
		<AbsoluteFill>
			<Write text={'الراجل بيتكلم..\nبس مش دايمًا بالكلام'} from={0} dur={30} y={230} size={84} color={INK} lineHeight={1.45} />
			<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{position: 'absolute', inset: 0}}>
				<Draw d={bubble(260, 560, 560, 300)} from={40} dur={24} color={SOFT} w={6} />
				{dots.map((i) => {
					const p = usePop(70 + i * 10);
					return <circle key={i} cx={380 + i * 110} cy={710} r={20} fill={SOFT} transform={`scale(${p})`} style={{transformOrigin: `${380 + i * 110}px 710px`}} />;
				})}
				<Man x={540} y={1400} s={1.25} mood="flat" from={90} each={4} />
				<Draw d={bubble(600, 1000, 420, 230)} from={150} dur={22} color={MAROON} w={7} />
				<Draw d={`M 680 1085 L 960 1085`} from={170} dur={10} color={MAROON} w={6} />
				<Draw d={`M 680 1150 L 920 1150`} from={180} dur={10} color={MAROON} w={6} />
			</svg>
		</AbsoluteFill>
	);
};

/* ---------- SCENE 4 — الكتاب ---------- */
export const RS4: React.FC = () => {
	const p = usePop(0);
	return (
		<AbsoluteFill>
			<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{position: 'absolute', inset: 0}}>
				<g transform={`translate(${W / 2} 880) scale(${p}) translate(${-W / 2} -880)`}>
					<rect x={260} y={560} width={560} height={640} rx={14} fill={MAROON} />
					<rect x={260} y={560} width={560} height={640} rx={14} fill="none" stroke={GOLD} strokeWidth={6} />
					<rect x={290} y={580} width={500} height={600} rx={8} fill="none" stroke={GOLD} strokeWidth={2} opacity={0.6} />
				</g>
				<Draw d={circle(540, 1080, 30)} from={40} dur={12} color={GOLD} w={10} />
				<Draw d={`M 540 1110 L 540 1220 M 540 1190 L 580 1190 M 540 1220 L 580 1220`} from={50} dur={18} color={GOLD} w={12} />
			</svg>
			<Write text={'شفرة الرجالة'} from={20} dur={24} y={700} size={116} color={PAPER} />
			<Write text={'دليل للست عشان تفهم\nجوزها من جوه'} from={70} dur={30} y={1340} size={70} color={INK} lineHeight={1.5} />
		</AbsoluteFill>
	);
};

/* ---------- SCENE 5 — الفوايد (3 نقط) ---------- */
export const RS5: React.FC = () => {
	const rows: {text: string; y: number; from: number}[] = [
		{text: 'تفهمي اللي جوزك\nمش قادر يقوله', y: 300, from: 0},
		{text: 'تتكلموا من غير خناقة', y: 760, from: 50},
		{text: 'وترجعوا قريبين\nمن تاني', y: 1120, from: 100},
	];
	return (
		<AbsoluteFill>
			{rows.map((r, i) => (
				<React.Fragment key={i}>
					<Write text={r.text} from={r.from} dur={24} y={r.y} size={72} color={INK} lineHeight={1.5} />
					<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{position: 'absolute', inset: 0}}>
						<Draw d={tick(540, r.y + 300, 60)} from={r.from + 40} dur={12} color={GREEN} w={12} />
					</svg>
				</React.Fragment>
			))}
		</AbsoluteFill>
	);
};

/* ---------- SCENE 6 — الخصوصية ---------- */
export const RS6: React.FC = () => {
	const s = usePop(0);
	return (
		<AbsoluteFill>
			<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{position: 'absolute', inset: 0}}>
				<g transform={`translate(540 760) scale(${s}) translate(-540 -760)`}>
					<path d={shield(540, 760)} fill="none" stroke={GOLD} strokeWidth={10} strokeLinejoin="round" />
					<path d={tick(540, 770, 70)} fill="none" stroke={MAROON} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
				</g>
			</svg>
			<Write text="خصوصية تامة" from={30} dur={20} y={1080} size={96} color={MAROON} />
			<Write text={'وخطوات عملية،\nمش نظريات'} from={70} dur={24} y={1250} size={72} color={INK} lineHeight={1.5} />
		</AbsoluteFill>
	);
};

/* ---------- SCENE 7 — CTA ---------- */
export const RS7: React.FC = () => {
	const p = usePop(0);
	return (
		<AbsoluteFill>
			<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{position: 'absolute', inset: 0}}>
				<g transform={`translate(540 720) scale(${p}) translate(-540 -720)`}>
					<path d={bubble(180, 560, 720, 320)} fill={MAROON} />
				</g>
				<Draw d={arrowDown(540, 920, 170)} from={40} dur={16} color={MAROON} w={12} />
			</svg>
			<Write text={'ابعتي رسالة واتساب\nواطلبي نسختك دلوقتي'} from={20} dur={24} y={640} size={68} color={PAPER} lineHeight={1.5} />
			<Write text={'اطلبي نسختك'} from={60} dur={20} y={1180} size={110} color={MAROON} />
		</AbsoluteFill>
	);
};

/* ---------- Scene timing (frames @30fps, total 1200 = 40s) ---------- */
export const REJALA_SCENES: {C: React.FC; dur: number}[] = [
	{C: RS1, dur: 150},
	{C: RS2, dur: 150},
	{C: RS3, dur: 180},
	{C: RS4, dur: 180},
	{C: RS5, dur: 210},
	{C: RS6, dur: 150},
	{C: RS7, dur: 180},
];

export const REJALA_DURATION = REJALA_SCENES.reduce((a, s) => a + s.dur, 0);

const FadeOut: React.FC<{dur: number; children: React.ReactNode}> = ({dur, children}) => {
	const f = useCurrentFrame();
	const o = interpolate(f, [dur - 8, dur], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return <div style={{opacity: o, position: 'absolute', inset: 0}}>{children}</div>;
};

/* Silent-first ad: on-screen Arabic text carries the message. */
export const RejalaAd: React.FC = () => {
	let start = 0;
	return (
		<AbsoluteFill style={{background: PAPER, fontFamily: READEX}}>
			{REJALA_SCENES.map(({C, dur}, i) => {
				const from = start;
				start += dur;
				return (
					<Sequence key={i} from={from} durationInFrames={dur} layout="none">
						<FadeOut dur={dur}>
							<C />
						</FadeOut>
					</Sequence>
				);
			})}
			<div
				style={{
					position: 'absolute',
					bottom: 60,
					left: 0,
					right: 0,
					textAlign: 'center',
					fontFamily: AMIRI,
					fontWeight: 700,
					fontSize: 44,
					color: SOFT,
					direction: 'rtl',
				}}
			>
				شفرة الرجالة
			</div>
		</AbsoluteFill>
	);
};
