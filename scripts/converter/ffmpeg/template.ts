// このファイルでは FFmpeg のみを使った変換処理の内容を構成している

import { preprocess } from "./preprocess";
import { ffmpeg } from "./command";

import { encryptionKeys, segmentDuration } from "~/consts";

import { Container, ConvertDescriptionFFmpeg } from "~/types/convert-description";

import { identifiers, paths } from "~/utils/config";
import { makeDirs } from "~/utils/file-handle";
import { forEach } from "~/utils/misc";

/**
 * 完全に FFmpeg を使った処理を実装する
 * * 引数に `ConvertDescription` 型の構成を渡す
 */
export const ffmpegTemplate = async (cd: ConvertDescriptionFFmpeg) => {
	// `runMode` の値によって場合分けして、それぞれの該当する関数を呼び出す。
	switch (cd.runMode) {
		case "mse": {
			await templateMse(cd);
		} break;
		case "mse+eme": {
			await templateMseEme(cd);
		} break;
		case "eme": {
			await templateEme(cd);
		} break;
	}
};

/** MSE が利用可能になるように、セグメント分けを行う処理を記述する */
const templateMse = async (cd: ConvertDescriptionFFmpeg) => {

	// プリプロセス処理を実行して、元の動画から映像のみ、音声のみのファイルを取り出す
	if (!cd.skipPreprocess) await preprocess({
		container: cd.container,
		videoCodec: cd.videoCodec,
		audioCodec: cd.audioCodec,
		merged: false,
	});

	// 出力先のディレクトリを事前に用意する
	await makeDirs(paths.intermediateDir);

	// それぞれの成分毎の処理を並列に実行する
	await forEach(identifiers, async (id) => {
		/** プリプロセスを実行した直後の動画ファイルのパス */
		const preprocessed = paths.preprocessed(id, cd);
		/** セグメント毎に別々のファイルに分割した動画ファイルの保存先ディレクトリ */
		const splitted = paths.segmentsDir(id);

		// セグメント毎のファイルの出力先ディレクトリを生成する
		await makeDirs(splitted);

		// セグメントの拡張子を決定する
		const initExt = cd.container;
		const mediaExt = cd.container == Container.MP4 ? "m4s" : cd.container;

		// セグメント毎に別々のファイルに分ける
		await ffmpeg({
			input: preprocessed,
			split: true,
			audioCodec: id === "audio" ? "copy" : null,
			videoCodec: id !== "audio" ? "copy" : null,
			container: cd.container,
			outputDash: `${splitted}/stream.mpd`,
			outputInit: `init.${initExt}`,
			outputMedia: `seg-$Number$.${mediaExt}`,
			splitDuration: segmentDuration
		});
	});
};

/** MSE と EME が利用可能になるように、セグメント分けと暗号化を行う処理を記述する */
const templateMseEme = async (cd: ConvertDescriptionFFmpeg) => {
	// プリプロセス処理を実行して、元の動画から映像のみ、音声のみのファイルを取り出す
	if (!cd.skipPreprocess) await preprocess({
		container: cd.container,
		videoCodec: cd.videoCodec,
		audioCodec: cd.audioCodec,
		merged: false,
	});

	// 出力先のディレクトリを事前に用意する
	await makeDirs(paths.intermediateDir);

	// それぞれの成分毎の処理を並列に実行する
	await forEach(identifiers, async (id) => {
		/** プリプロセスを実行した直後の動画ファイルのパス */
		const preprocessed = paths.preprocessed(id, cd);
		/** 暗号化した動画ファイルのパス */
		const encrypted = paths.encrypted(id, cd.container);
		/** セグメント毎に別々のファイルに分割した動画ファイルの保存先ディレクトリ */
		const splitted = paths.encryptedSegmentsDir(id);

		// 暗号化キーを選択する
		const keyPair =
			id === "audio" ?
			encryptionKeys.audio :
			encryptionKeys.video;

		// 暗号化する
		await ffmpeg({
			input: preprocessed,
			output: encrypted,
			audioCodec: id === "audio" ? "copy" : null,
			videoCodec: id !== "audio" ? "copy" : null,
			encryption: keyPair
		});

		// セグメント毎のファイルの出力先ディレクトリを生成する
		await makeDirs(splitted);

		// セグメントの拡張子を決定する
		const initExt = cd.container;
		const mediaExt = cd.container == Container.MP4 ? "m4s" : cd.container;

		// セグメント毎に別々のファイルに分ける
		await ffmpeg({
			input: encrypted,
			split: true,
			audioCodec: id === "audio" ? "copy" : null,
			videoCodec: id !== "audio" ? "copy" : null,
			container: cd.container,
			outputDash: `${splitted}/stream.mpd`,
			outputInit: `init.${initExt}`,
			outputMedia: `seg-$Number$.${mediaExt}`,
			splitDuration: segmentDuration
		});
	});
};

/** EME が利用可能になるように、暗号化を行う処理を記述する */
const templateEme = async (cd: ConvertDescriptionFFmpeg) => {
	// プリプロセス処理を実行する
	if (!cd.skipPreprocess) await preprocess({
		container: cd.container,
		videoCodec: cd.videoCodec,
		audioCodec: cd.audioCodec,
		merged: false,
		singleResolution: true,
		disableKeyframeAdjust: true
	});

	// オーディオ、ビデオそれぞれの処理を並列に実行する
	const encryptedPaths = await forEach(
		["audio", "video"] as const,
		async (target) => {
			/** プリプロセスを実行した直後の動画ファイルのパス */
			const preprocessed = paths.preprocessed(target, cd);
			/** 暗号化した動画ファイルのパス */
			const encrypted = paths.encrypted(target, cd.container);

			// 暗号化キーを選択する
			const keyPair = encryptionKeys[target];

			// 暗号化する
			await ffmpeg({
				input: preprocessed,
				output: encrypted,
				encryption: keyPair
			});

			// 出力されるファイルを返す
			return encrypted;
		}
	);

	/** 暗号化したものを結合した動画ファイルのパス */
	const merged = paths.encryptedMerged(cd.container);

	// 出力先のディレクトリを事前に用意する
	await makeDirs(paths.outputDir);

	// 別個に暗号化処理を実行したものを結合する
	await ffmpeg({
		input: encryptedPaths,
		output: merged,
		videoCodec: "copy",
		audioCodec: "copy"
	});
};