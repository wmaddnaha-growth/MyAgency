import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {AMIRI, READEX, Draw, Man, Questions, Write, circle, ellipse, rect, usePop} from './kit';

/*
 * "شفرة الرجالة" — StoryBrand 7 whiteboard ad (55s, 9:16).
 * Script: campaigns/شفرة-الرجالة/07-ads/whiteboard-scripts-v2.md (section 4).
 * Silent-first: every line is on screen. Pass `voiceover` (file in public/) to add VO later.
 */

const MAROON = '#5A1B2C';
const GOLD = '#9A7432';
const INK = '#1A1612';
const PAPER = '#FBF7F0';
const SOFT = '#8C857A';
const GREEN = '#2E7D4F';

const W = 1080;
const H = 1920;

/* ---------- local shapes ---------- */
export const heart = (cx: number, cy: number, s: number) =>
	`M ${cx} ${cy + s * 0.9} C ${cx - s * 1.6} ${cy - s * 0.1} ${cx - s * 0.6} ${cy - s * 1.1} ${cx} ${cy - s * 0.35} C ${cx + s * 0.6} ${cy - s * 1.1} ${cx + s * 1.6} ${cy - s * 0.1} ${cx} ${cy + s * 0.9} Z`;

const bubble = (x: number, y: number, w: number, h: number) =>
	`M ${x + 24} ${y} L ${x + w - 24} ${y} Q ${x + w} ${y} ${x + w} ${y + 24} L ${x + w} ${y + h - 24} Q ${x + w} ${y + h} ${x + w - 24} ${y + h} L ${x + w * 0.35} ${y + h} L ${x + w * 0.2} ${y + h + 30} L ${x + w * 0.24} ${y + h} L ${x + 24} ${y + h} Q ${x} ${y + h} ${x} ${y + h - 24} L ${x} ${y + 24} Q ${x} ${y} ${x + 24} ${y} Z`;

const tick = (x: number, y: number, s: number) =>
	`M ${x - s} ${y} L ${x - s * 0.25} ${y + s * 0.8} L ${x + s} ${y - s * 0.8}`;

const arrowDown = (x: number, y: number, len: number) =>
	`M ${x} ${y} L ${x} ${y + len} M ${x - 34} ${y + len - 34} L ${x} ${y + len} L ${x + 34} ${y + len - 34}`;

/** Stick-figure woman (long hair + dress), feet at (x, y). */
const womanPaths = (x: number, y: number, s = 1, mood: 'sad' | 'flat' | 'smile' = 'flat') => {
	const k = (v: number) => v * s;
	const cy = y - k(190);
	const r = k(34);
	const sh = y - k(135);
	const p = [
		circle(x, cy, r),
		`M ${x - k(36)} ${cy + k(48)} Q ${x - k(52)} ${cy - k(52)} ${x} ${cy - k(42)} Q ${x + k(52)} ${cy - k(52)} ${x + k(36)} ${cy + k(48)}`,
		`M ${x} ${y - k(156)} L ${x} ${y - k(140)}`,
		`M ${x} ${y - k(140)} L ${x - k(48)} ${y - k(50)} L ${x + k(48)} ${y - k(50)} Z`,
		`M ${x - k(18)} ${y - k(50)} L ${x - k(20)} ${y}`,
		`M ${x + k(18)} ${y - k(50)} L ${x + k(20)} ${y}`,
		`M ${x - k(10)} ${sh} L ${x - k(48)} ${y - k(95)}`,
		`M ${x + k(10)} ${sh} L ${x + k(48)} ${y - k(95)}`,
		`M ${x - k(11)} ${cy - k(6)} l 0.1 0`,
		`M ${x + k(11)} ${cy - k(6)} l 0.1 0`,
	];
	const my = cy + k(14);
	if (mood === 'sad') p.push(`M ${x - k(12)} ${my + k(5)} Q ${x} ${my - k(6)} ${x + k(12)} ${my + k(5)}`);
	else if (mood === 'smile') p.push(`M ${x - k(13)} ${my - k(3)} Q ${x} ${my + k(10)} ${x + k(13)} ${my - k(3)}`);
	else p.push(`M ${x - k(11)} ${my} L ${x + k(11)} ${my}`);
	return p;
};

export const Woman: React.FC<{x: number; y: number; s?: number; mood?: 'sad' | 'flat' | 'smile'; from?: number; each?: number}> = ({
	x,
	y,
	s = 1,
	mood = 'flat',
	from = 0,
	each = 4,
}) => (
	<g>
		{womanPaths(x, y, s, mood).map((d, i) => (
			<Draw key={i} d={d} from={from + i * each} dur={each + 2} w={7 * Math.max(0.7, s)} />
		))}
	</g>
);

const Svg: React.FC<{children: React.ReactNode}> = ({children}) => (
	<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{position: 'absolute', inset: 0}}>
		{children}
	</svg>
);

/** Scale an SVG group in from its center with a spring */
const PopG: React.FC<{from: number; cx: number; cy: number; children: React.ReactNode}> = ({from, cx, cy, children}) => {
	const p = usePop(from);
	return <g transform={`translate(${cx} ${cy}) scale(${p}) translate(${-cx} ${-cy})`}>{children}</g>;
};

/** Book cover (maroon + gold key), centered at (cx, cy) */
export const Book: React.FC<{cx: number; cy: number; s?: number; from: number}> = ({cx, cy, s = 1, from}) => {
	const w = 460 * s, h = 560 * s;
	const x = cx - w / 2, y = cy - h / 2;
	return (
		<>
			<PopG from={from} cx={cx} cy={cy}>
				<rect x={x} y={y} width={w} height={h} rx={14} fill={MAROON} />
				<rect x={x} y={y} width={w} height={h} rx={14} fill="none" stroke={GOLD} strokeWidth={6} />
				<rect x={x + 24 * s} y={y + 20 * s} width={w - 48 * s} height={h - 40 * s} rx={8} fill="none" stroke={GOLD} strokeWidth={2} opacity={0.6} />
			</PopG>
			<Draw d={circle(cx, cy + 110 * s, 26 * s)} from={from + 30} dur={10} color={GOLD} w={9} />
			<Draw
				d={`M ${cx} ${cy + 136 * s} L ${cx} ${cy + 230 * s} M ${cx} ${cy + 200 * s} L ${cx + 34 * s} ${cy + 200 * s} M ${cx} ${cy + 226 * s} L ${cx + 34 * s} ${cy + 226 * s}`}
				from={from + 38}
				dur={14}
				color={GOLD}
				w={10}
			/>
		</>
	);
};

/* ---------- 1. CHARACTER + WANT (0–6s) ---------- */
const S1: React.FC = () => (
	<AbsoluteFill>
		<Write text={'منى عايزة حاجة واحدة:'} from={-14} dur={22} y={230} size={80} color={INK} />
		<Write text={'ترجع تحس إن\nجوزها شايفها'} from={-16} dur={34} y={360} size={100} color={MAROON} lineHeight={1.4} />
		<Svg>
			<Woman x={430} y={1500} s={1.35} mood="flat" from={6} each={3} />
			<path d={heart(720, 1090, 120)} fill="none" stroke={SOFT} strokeWidth={8} strokeDasharray="4 22" strokeLinecap="round" opacity={interpolate(useCurrentFrame(), [50, 70], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />
		</Svg>
	</AbsoluteFill>
);

/* ---------- 2a. PROBLEM — external (6–12s) ---------- */
const S2: React.FC = () => (
	<AbsoluteFill>
		<Write text={'روتين.. سكوت..'} from={-10} dur={20} y={240} size={96} color={INK} />
		<Write text={'كل واحد في دنيا لوحده'} from={91} dur={24} y={380} size={78} color={MAROON} />
		<Svg>
			<Man x={300} y={1340} s={1.15} mood="flat" from={10} each={3} armR={[60, -150]} />
			<Draw d={rect(355, 1120, 36, 60)} from={40} dur={10} w={5} />
			<Woman x={790} y={1340} s={1.15} mood="flat" from={20} each={3} />
			<Draw d={`M 150 1340 L 150 1240 L 930 1240 L 930 1340 M 120 1340 L 960 1340 M 150 1340 L 150 1400 M 930 1340 L 930 1400`} from={50} dur={24} color={SOFT} w={8} />
			<Draw d={`M 545 980 L 545 1330`} from={90} dur={20} color={MAROON} w={6} />
		</Svg>
	</AbsoluteFill>
);

/* ---------- 2b. PROBLEM — internal (12–17s) ---------- */
const S3: React.FC = () => (
	<AbsoluteFill>
		<Write text={'ومن جواها بتسأل..'} from={-10} dur={20} y={230} size={84} color={INK} />
		<Svg>
			<Woman x={340} y={1500} s={1.25} mood="sad" from={4} each={3} />
			<Draw d={ellipse(780, 1180, 150, 220)} from={20} dur={20} color={SOFT} w={9} />
			<Draw d={`M 780 1400 L 780 1500 M 690 1500 L 870 1500`} from={34} dur={12} color={SOFT} w={9} />
			<Draw d={ellipse(540, 620, 400, 150)} from={46} dur={20} color={MAROON} w={6} />
			<Draw d={circle(390, 820, 22)} from={60} dur={6} color={MAROON} w={5} />
			<Draw d={circle(360, 880, 14)} from={64} dur={6} color={MAROON} w={5} />
		</Svg>
		<Write text={'"يمكن العيب فيّا؟"'} from={55} dur={22} y={565} size={84} color={MAROON} />
		<Write text={'ومكسوفة تسأل أي حد'} from={98} dur={20} y={1580} size={66} color={SOFT} />
	</AbsoluteFill>
);

/* ---------- 2c. PROBLEM — philosophical (17–21s) ---------- */
const S4: React.FC = () => {
	const f = useCurrentFrame();
	const fade = interpolate(f, [30, 100], [1, 0.12], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<AbsoluteFill>
			<Svg>
				<Draw d={`M 300 1050 L 540 840 L 780 1050`} from={-6} dur={16} w={9} />
				<Draw d={rect(330, 1050, 420, 380)} from={6} dur={18} w={9} />
				<Draw d={rect(500, 1270, 80, 160)} from={20} dur={10} w={7} />
				<path d={heart(540, 1150, 70)} fill={MAROON} opacity={fade} />
			</Svg>
			<Write text={'ومفيش ست تستاهل تعيش\nجنب جوزها..'} from={10} dur={26} y={260} size={78} color={INK} lineHeight={1.45} />
			<Write text={'كأنها ضيفة في بيتها'} from={72} dur={22} y={1520} size={90} color={MAROON} />
		</AbsoluteFill>
	);
};

/* ---------- 3a. GUIDE — empathy (21–25s) ---------- */
const S5: React.FC = () => (
	<AbsoluteFill>
		<Write text={'إحنا فاهمين\nالإحساس ده'} from={-10} dur={24} y={260} size={100} color={MAROON} lineHeight={1.4} />
		<Svg>
			<Woman x={540} y={1450} s={1.3} mood="flat" from={6} each={3} />
			<PopG from={50} cx={540} cy={1000}>
				<path d={heart(540, 1000, 60)} fill={GOLD} />
			</PopG>
		</Svg>
		<Write text={'ومحدش بيتكلم فيه'} from={60} dur={20} y={1560} size={76} color={INK} />
	</AbsoluteFill>
);

/* ---------- 3b. GUIDE — authority (25–30s) ---------- */
const S6: React.FC = () => {
	const items = ['16 فصل بيترجموا دماغ الراجل', 'خطة 14 يوم', '4 هدايا عملية'];
	return (
		<AbsoluteFill>
			<Svg>
				<Book cx={540} cy={620} s={0.9} from={-4} />
			</Svg>
			<Write text={'شفرة الرجالة'} from={10} dur={20} y={430} size={92} color={PAPER} />
			{items.map((t, i) => (
				<React.Fragment key={i}>
					<Write text={t} from={[81, 159, 210][i]} dur={18} x={60} w={820} y={1010 + i * 150} size={62} color={INK} />
					<Svg>
						<Draw d={tick(940, 1060 + i * 150, 28)} from={[87, 165, 216][i]} dur={10} color={GREEN} w={10} />
					</Svg>
				</React.Fragment>
			))}
		</AbsoluteFill>
	);
};

/* ---------- 4. PLAN — 3 steps (30–38s) ---------- */
const S7: React.FC = () => {
	const steps = [
		{n: '١', t: 'اطلبي الكتاب\nمن الموقع'},
		{n: '٢', t: 'يوصلك على الواتساب\nبخصوصية'},
		{n: '٣', t: 'خطوة صغيرة\nكل يوم'},
	];
	return (
		<AbsoluteFill>
			<Write text={'الموضوع سهل:'} from={-10} dur={18} y={180} size={90} color={MAROON} />
			{steps.map((s, i) => {
				const from = [30, 100, 184][i];
				const y = 420 + i * 420;
				return (
					<React.Fragment key={i}>
						<Svg>
							<Draw d={circle(900, y + 90, 70)} from={from} dur={14} color={MAROON} w={8} />
							{i < 2 && <Draw d={arrowDown(900, y + 180, 200)} from={from + 40} dur={14} color={SOFT} w={6} />}
						</Svg>
						<Write text={s.n} from={from + 8} dur={8} x={830} w={140} y={y + 22} size={96} color={MAROON} lineHeight={1.2} />
						<Write text={s.t} from={from + 14} dur={22} x={40} w={760} y={y} size={66} color={INK} lineHeight={1.45} />
					</React.Fragment>
				);
			})}
		</AbsoluteFill>
	);
};

/* ---------- 5. CALL TO ACTION (38–42s) ---------- */
const CTA: React.FC<{label?: string}> = ({label = 'اطلبي من الموقع\nدلوقتي'}) => (
	<AbsoluteFill>
		<Svg>
			<PopG from={0} cx={540} cy={760}>
				<path d={bubble(160, 560, 760, 380)} fill={MAROON} />
			</PopG>
			<Draw d={arrowDown(540, 1000, 160)} from={30} dur={14} color={MAROON} w={12} />
		</Svg>
		<Write text={label} from={8} dur={22} y={620} size={96} color={PAPER} lineHeight={1.4} />
		<Write text={'بخصوصية تامة'} from={40} dur={18} y={1200} size={100} color={MAROON} />
	</AbsoluteFill>
);
const S8: React.FC = () => <CTA />;

/* ---------- 6. FAILURE (42–47s) ---------- */
const S9: React.FC = () => {
	const f = useCurrentFrame();
	const gap = interpolate(f, [20, 130], [0, 170], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const years = ['سنة', 'سنتين', '٣ سنين'];
	return (
		<AbsoluteFill style={{filter: 'grayscale(1)'}}>
			<Write text={'أو.. تفضل سنة كمان'} from={-10} dur={22} y={230} size={88} color={INK} />
			<Write text={'بنفس المسافة، وبنفس السكوت'} from={65} dur={24} y={370} size={66} color={SOFT} />
			<Svg>
				<Man x={400 - gap} y={1260} s={1.1} mood="flat" from={0} each={2} />
				<Woman x={680 + gap} y={1260} s={1.1} mood="sad" from={6} each={2} />
				<Draw d={`M 120 1460 L 960 1460`} from={20} dur={20} color={SOFT} w={6} />
				{years.map((_, i) => (
					<Draw key={i} d={`M ${260 + i * 280} 1440 L ${260 + i * 280} 1480`} from={40 + i * 30} dur={6} color={SOFT} w={6} />
				))}
			</Svg>
			{years.map((y, i) => (
				<Write key={i} text={y} from={44 + i * 30} dur={10} x={160 + i * 280} w={200} y={1500} size={48} color={SOFT} />
			))}
		</AbsoluteFill>
	);
};

/* ---------- 7. SUCCESS + final CTA (47–55s) ---------- */
const S10: React.FC = () => {
	const f = useCurrentFrame();
	const mx = interpolate(f, [0, 60], [80, 380], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (t) => 1 - (1 - t) * (1 - t)});
	const walking = f < 60;
	const endCta = f >= 196;
	if (endCta) {
		return (
			<Sequence from={196} layout="none">
				<CTA />
			</Sequence>
		);
	}
	return (
		<AbsoluteFill>
			<Write text={'يرجع من الشغل\nمستني يشوفها'} from={-10} dur={26} y={200} size={96} color={MAROON} lineHeight={1.4} />
			<Svg>
				<Man x={mx} y={1350} s={1.2} mood="smile" walk={walking} from={0} each={2} />
				<Woman x={720} y={1350} s={1.2} mood="smile" from={0} each={2} />
				<PopG from={64} cx={550} cy={920}>
					<path d={heart(550, 920, 70)} fill={MAROON} />
				</PopG>
			</Svg>
			<Write text={'مراته..\nمش بس أم العيال'} from={88} dur={26} y={1440} size={82} color={INK} lineHeight={1.4} />
		</AbsoluteFill>
	);
};

/* ---------- timing (frames @30fps, total 1764 = 58.8s) — matched to word timings of public/rejala-sb7-vo-v2.mp3 ---------- */
export const SB7_SCENES: {C: React.FC; dur: number}[] = [
	{C: S1, dur: 167},
	{C: S2, dur: 165},
	{C: S3, dur: 155},
	{C: S4, dur: 121},
	{C: S5, dur: 132},
	{C: S6, dur: 260},
	{C: S7, dur: 297},
	{C: S8, dur: 54},
	{C: S9, dur: 145},
	{C: S10, dur: 268},
];

export const SB7_DURATION = SB7_SCENES.reduce((a, s) => a + s.dur, 0);

const FadeOut: React.FC<{dur: number; children: React.ReactNode}> = ({dur, children}) => {
	const f = useCurrentFrame();
	const o = interpolate(f, [dur - 8, dur], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return <div style={{opacity: o, position: 'absolute', inset: 0}}>{children}</div>;
};

export const RejalaSB7: React.FC<{voiceover?: string}> = ({voiceover}) => {
	let start = 0;
	return (
		<AbsoluteFill style={{background: PAPER, fontFamily: READEX}}>
			{voiceover && <Audio src={staticFile(voiceover)} />}
			{SB7_SCENES.map(({C, dur}, i) => {
				const from = start;
				start += dur;
				const last = i === SB7_SCENES.length - 1;
				return (
					<Sequence key={i} from={from} durationInFrames={dur} layout="none">
						{last ? (
							<C />
						) : (
							<FadeOut dur={dur}>
								<C />
							</FadeOut>
						)}
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
