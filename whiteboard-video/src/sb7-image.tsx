import React from 'react';
import {AbsoluteFill} from 'remotion';
import {AMIRI, READEX, Draw, Man, Write, rect} from './kit';
import {Book, Woman} from './sb7';

/*
 * "شفرة الرجالة" — static image ad (4:5, 1080×1350) for the StoryBrand 7 Meta campaign.
 * Copy: campaigns/شفرة-الرجالة/07-ads/meta-ad-sb7-copy.md
 * Render a still at a late frame so every stroke is fully drawn:
 *   npx remotion still src/index.ts RejalaSB7Image out/rejala-sb7-image-4x5.png --frame=80
 */

const MAROON = '#5A1B2C';
const INK = '#1A1612';
const PAPER = '#FBF7F0';
const SOFT = '#8C857A';
const GOLD = '#9A7432';

const W = 1080;
const H = 1350;

export const SB7_IMAGE_DURATION = 90;

export const RejalaSB7Image: React.FC = () => (
	<AbsoluteFill style={{background: PAPER, fontFamily: READEX}}>
		{/* Hook */}
		<Write text={'منى عايزة حاجة واحدة:'} from={0} dur={1} y={70} size={60} color={INK} />
		<Write text={'ترجع تحس إن جوزها شايفها'} from={0} dur={1} y={160} size={86} color={MAROON} />

		{/* Scene: same sofa, two worlds */}
		<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{position: 'absolute', inset: 0}}>
			<Man x={310} y={700} s={0.95} mood="flat" from={0} each={1} armR={[60, -150]} />
			<Draw d={rect(360, 512, 30, 50)} from={0} dur={1} w={5} />
			<Woman x={770} y={700} s={0.95} mood="sad" from={0} each={1} />
			<Draw
				d={`M 170 700 L 170 615 L 910 615 L 910 700 M 140 700 L 940 700 M 170 700 L 170 750 M 910 700 L 910 750`}
				from={0}
				dur={1}
				color={SOFT}
				w={8}
			/>
			<Draw d={`M 540 400 L 540 690`} from={0} dur={1} color={MAROON} w={6} />
			<Draw d={`M 80 885 L 1000 885`} from={0} dur={1} color={SOFT} w={2} opacity={0.5} />
			<Book cx={235} cy={1080} s={0.55} from={-60} />
			<rect x={420} y={1105} width={600} height={104} rx={52} fill={MAROON} />
		</svg>
		<Write text={'روتين.. سكوت.. وكل واحد في دنيا لوحده'} from={0} dur={1} y={775} size={50} color={SOFT} />

		{/* Book + offer */}
		<div
			style={{
				position: 'absolute',
				left: 108,
				top: 950,
				width: 254,
				textAlign: 'center',
				direction: 'rtl',
				fontFamily: AMIRI,
				fontWeight: 700,
				fontSize: 52,
				lineHeight: 1.2,
				color: PAPER,
			}}
		>
			شفرة
			<br />
			الرجالة
		</div>
		<Write text={'شفرة الرجالة'} from={0} dur={1} x={420} w={600} y={915} size={84} color={MAROON} lineHeight={1.3} />
		<Write text={'16 فصل • خطة 14 يوم • 4 هدايا'} from={0} dur={1} x={420} w={600} y={1030} size={40} color={INK} lineHeight={1.3} />
		<Write text={'اطلبي من الموقع دلوقتي'} from={0} dur={1} x={420} w={600} y={1120} size={54} color={PAPER} lineHeight={1.3} />
		<Write text={'🔒 يوصلك على الواتساب بخصوصية تامة'} from={0} dur={1} x={420} w={600} y={1235} size={34} color={GOLD} lineHeight={1.3} />
	</AbsoluteFill>
);
