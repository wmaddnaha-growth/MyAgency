import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {SCENES} from './scenes';
import {SUBS} from './subs';
import {READEX, STAGE_H} from './kit';

const FadeOut: React.FC<{dur: number; children: React.ReactNode}> = ({dur, children}) => {
	const f = useCurrentFrame();
	const o = interpolate(f, [dur - 8, dur], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return <div style={{opacity: o}}>{children}</div>;
};

const Subtitle: React.FC = () => {
	const f = useCurrentFrame();
	const s = SUBS.find((x) => f >= x.from && f < x.to);
	if (!s) return null;
	return (
		<div
			style={{
				direction: 'rtl',
				textAlign: 'center',
				fontFamily: READEX,
				fontWeight: 700,
				fontSize: 46,
				lineHeight: 1.55,
				color: '#fff',
				background: 'rgba(28,26,23,.88)',
				padding: '14px 28px',
				borderRadius: 14,
				maxWidth: 960,
				margin: '0 auto',
			}}
		>
			{s.text}
		</div>
	);
};

export type VideoProps = {format: 'vertical' | 'feed'; voiceover?: string};

export const SaqiaVideo: React.FC<VideoProps> = ({format, voiceover}) => {
	const stageTop = format === 'vertical' ? 250 : 20;
	const subTop = stageTop + STAGE_H + (format === 'vertical' ? 40 : -10);
	let start = 0;
	return (
		<AbsoluteFill style={{background: '#FDFCF9'}}>
			{voiceover ? <Audio src={staticFile(voiceover)} /> : null}
			<div style={{position: 'absolute', top: stageTop, left: 0}}>
				{SCENES.map(({C, dur}, i) => {
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
			</div>
			<div style={{position: 'absolute', top: subTop, left: 40, right: 40}}>
				<Subtitle />
			</div>
		</AbsoluteFill>
	);
};
