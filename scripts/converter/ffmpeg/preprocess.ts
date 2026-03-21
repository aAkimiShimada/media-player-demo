// このファイルでは `ffmpeg` コマンドを使ったプリプロセス処理の内容を構成している

import { ffmpeg, type FFmpegKeyframesOption } from "./command";

import {
	Resolution, resolutions,
	segmentCount, segmentDuration, videoFramerate
} from "~/consts";

import { AudioCodec, Container, VideoCodec } from "~/types/convert-description";

import { paths } from "~/utils/config";
import { makeDirs } from "~/utils/file-handle";

/**
 * セグメント分けや暗号化を行う前のプリプロセス処理を実行する
 *
 * プリプロセスとは具体的に次の操作を行う
 * * 映像と音声を所定のコーデックでエンコードする
 * * 映像を解像度ごとに分ける
 * * 映像の左上に再生時刻が表記されるようにする
 * * 映像のキーフレームがセグメント分けを行う箇所になるように調整する
 */
export const preprocess =
async (option: PreprocessOption) => {

	// 出力先のディレクトリを事前に用意する
	await makeDirs(paths.preprocessedDir);

	// オーディオとビデオを統合する場合
	if (option.merged) {
		/** 共通設定 */
		const common = {
			container: option.container,
			mode: "merged" as const,
			audioCodec: option.audioCodec,
			videoCodec: option.videoCodec,
			disableKeyframeAdjust: option.disableKeyframeAdjust
		};
		// 解像度別に扱う場合
		if (!option.singleResolution)
		{
			throw new Error("AV 統合で解像度別に扱うことはできません");
		}
		// 単一の解像度のみを扱う場合
		else {
			await preprocessOneItem({
				output: paths.preprocessedMerged(option),
				...common
			});
		}
	}

	// オーディオとビデオを統合しない場合
	else {
		// オーディオの処理
		{
			await preprocessOneItem({
				output: paths.preprocessed("audio", option),
				container: option.container,
				mode: "audio",
				audioCodec: option.audioCodec,
			});
		}

		// ビデオの処理
		{
			/** ビデオに関する共通設定 */
			const common = {
				container: option.container,
				mode: "video" as const,
				videoCodec: option.videoCodec,
				disableKeyframeAdjust: option.disableKeyframeAdjust
			};
			// 解像度別に扱う場合
			if (!option.singleResolution) {
				let index = 1;
				for (const res of resolutions) {
					await preprocessOneItem({
						output: paths.preprocessed(`video_${index}`, option),
						...common, resolution: res,
					});
					index++;
				}
			}
			// 単一の解像度のみを扱う場合
			else {
				await preprocessOneItem({
					output: paths.preprocessed("video", option),
					...common
				});
			}
		}
	}

};

/** 関数 `preprocess` に渡す引数のオブジェクトの型 */
type PreprocessOption = {
	/** コンテナ形式 */
	container: Container.Type;
	/** オーディオコーデック */
	audioCodec: AudioCodec.Type;
	/** ビデオコーデック */
	videoCodec: VideoCodec.Type;
	/**
	 * オーディオとビデオを統合して出力するか否かを明示する
	 * * `merged === false`
	 *   * 映像の解像度ごとに映像のみのファイルと、音声のみのファイルを生成
	 *      - `intermediateDirPath/preprocessed_audio.mp4` (or `.webm`)
	 *      - `intermediateDirPath/preprocessed_video_1.mp4` (or `.webm`)
	 *      - `intermediateDirPath/preprocessed_video_2.mp4` (or `.webm`)
	 *      - `intermediateDirPath/preprocessed_video_3.mp4` (or `.webm`)
	 * * `merged === true`
	 *   * 映像の解像度ごとに 映像+音声 になったファイルを生成
	 *      - `intermediateDirPath/preprocessed_av_1.mp4` (or `.webm`)
	 *      - `intermediateDirPath/preprocessed_av_2.mp4` (or `.webm`)
	 *      - `intermediateDirPath/preprocessed_av_3.mp4` (or `.webm`)
	 */
	merged: boolean;
	/** 単一の解像度のみを使用するか否か */
	singleResolution?: boolean;
	/** 映像のキーフレーム調整を行わない */
	disableKeyframeAdjust?: boolean;
};



/** 動画の終了時刻 */
const endTime = segmentDuration * segmentCount;

/**
 * プリプロセスにおける単一の項目を処理する
 */
const preprocessOneItem =
async (option: PreprocessOneItemOption): Promise<void> => {
	// オーディオのみの場合
	if (option.mode === "audio") {
		await ffmpeg({
			input: paths.sourcePath,
			output: option.output,
			start: 0, end: endTime,
			videoCodec: null,
			audioCodec: option.audioCodec,
		});
		return;
	}

	// 映像に埋め込むラベルテキストを用意する
	// テンプレート表記に従って再生時刻が埋め込まれる
	const labelText = (
		option.resolution != null ?
		`[${option.resolution}] %{pts\\:hms}` :
		"%{pts\\:hms}"
	);

	/** キーフレーム位置の調整を行うために必要なオプションを構成する */
	const keyframeOption: FFmpegKeyframesOption = {
		framerate: videoFramerate,
		durationInSec: segmentDuration
	};

	// ビデオのみの場合
	if (option.mode === "video") {
		await ffmpeg({
			input: paths.sourcePath,
			output: option.output,
			start: 0, end: endTime,
			videoCodec: option.videoCodec,
			audioCodec: null,
			resolution: option.resolution,
			keyframes: option.disableKeyframeAdjust ? null : keyframeOption,
			labelText
		});
		return;
	}

	// オーディオ/ビデオの双方がある場合
	if (option.mode === "merged") {
		await ffmpeg({
			input: paths.sourcePath,
			output: option.output,
			start: 0, end: endTime,
			audioCodec: option.audioCodec,
			videoCodec: option.videoCodec,
			resolution: option.resolution,
			keyframes: option.disableKeyframeAdjust ? null : keyframeOption,
			labelText
		});
	}

};

/** `preprocessOneItem` に渡す引数のオブジェクトの型 */
type PreprocessOneItemOption = (
	{
		/** 出力先のパス */
		output: string;
		/** 格納するコンテナの形式 */
		container: Container.Type;
	} & (
		| {
			/**
			 * 処理モードを指定する
			 * * `"audio"`: オーディオのみを取り出して変換処理を行う
			 * * `"video"`: ビデオのみを取り出して変換処理を行う
			 * * `"merged"`: オーディオとビデオの双方の変換処理を行い、1つのコンテナにまとめる
			 */
			mode: "audio";
			/** オーディオのコーデックを指定する */
			audioCodec: AudioCodec.Type;
		}
		| {
			/**
			 * 処理モードを指定する
			 * * `"audio"`: オーディオのみを取り出して変換処理を行う
			 * * `"video"`: ビデオのみを取り出して変換処理を行う
			 * * `"merged"`: オーディオとビデオの双方の変換処理を行い、1つのコンテナにまとめる
			 */
			mode: "video";
			/**
			 * ビデオの解像度を指定する
			 * * `ffmpeg` にそのまま渡されるオプションであり、指定がなければ解像度変換は行われない
			 */
			resolution?: Resolution;
			/** ビデオのコーデックを指定する */
			videoCodec: VideoCodec.Type;
			/** 映像のキーフレーム調整を行わない */
			disableKeyframeAdjust?: boolean;
		}
		| {
			/**
			 * 処理モードを指定する
			 * * `"audio"`: オーディオのみを取り出して変換処理を行う
			 * * `"video"`: ビデオのみを取り出して変換処理を行う
			 * * `"merged"`: オーディオとビデオの双方の変換処理を行い、1つのコンテナにまとめる
			 */
			mode: "merged";
			/**
			 * ビデオの解像度を指定する
			 * * `ffmpeg` にそのまま渡されるオプションであり、指定がなければ解像度変換は行われない
			 */
			resolution?: Resolution;
			/** ビデオのコーデックを指定する */
			videoCodec: VideoCodec.Type;
			/** オーディオのコーデックを指定する */
			audioCodec: AudioCodec.Type;
			/** 映像のキーフレーム調整を行わない */
			disableKeyframeAdjust?: boolean;
		}
	)
);