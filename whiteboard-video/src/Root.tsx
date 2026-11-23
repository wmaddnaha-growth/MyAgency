import React from 'react';
import {Composition} from 'remotion';
import {SaqiaVideo} from './Video';
import {RejalaAd, REJALA_DURATION} from './rejala';
import {RejalaSB7, SB7_DURATION} from './sb7';
import {RejalaSB7Image, SB7_IMAGE_DURATION} from './sb7-image';

// Put the recorded voice-over in public/ and set its file name here, e.g. 'vo.mp3'.
const VOICEOVER: string | undefined = 'vo.mp3';
const DURATION = 2145; // 71.5s at 30fps, matches the voice-over

export const Root: React.FC = () => (
	<>
		<Composition
			id="Saqia916"
			component={SaqiaVideo}
			durationInFrames={DURATION}
			fps={30}
			width={1080}
			height={1920}
			defaultProps={{format: 'vertical' as const, voiceover: VOICEOVER}}
		/>
		<Composition
			id="Rejala916"
			component={RejalaAd}
			durationInFrames={REJALA_DURATION}
			fps={30}
			width={1080}
			height={1920}
			defaultProps={{}}
		/>
		<Composition
			id="RejalaSB7"
			component={RejalaSB7}
			durationInFrames={SB7_DURATION}
			fps={30}
			width={1080}
			height={1920}
			defaultProps={{voiceover: 'rejala-sb7-vo-v2.mp3' as string | undefined}}
		/>
		<Composition
			id="RejalaSB7Image"
			component={RejalaSB7Image}
			durationInFrames={SB7_IMAGE_DURATION}
			fps={30}
			width={1080}
			height={1350}
			defaultProps={{}}
		/>
		<Composition
			id="Saqia45"
			component={SaqiaVideo}
			durationInFrames={DURATION}
			fps={30}
			width={1080}
			height={1350}
			defaultProps={{format: 'feed' as const, voiceover: VOICEOVER}}
		/>
	</>
);
