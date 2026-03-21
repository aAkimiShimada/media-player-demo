// このファイルでは動画コンバータのエントリポイントを構成している
// 実行する処理を選択して実行する

import { convertDescription } from "~/consts";

import { Tool } from "~/types/convert-description";

import { bento4Template } from "~/bento4/template";
import { ffmpegTemplate } from "~/ffmpeg/template";
import { mp4boxTemplate } from "~/gpac/template-mp4box";
import { gpacTemplate } from "~/gpac/template-gpac";
import { packagerTemplate } from "~/shaka/template";

/**
 * 動画コンバータのエントリーポイントを規定している
 */
const main = async () => {
	// 選択したツールに基づいて条件分岐
	switch (convertDescription.tool) {
		case Tool.FFmpeg:
			ffmpegTemplate(convertDescription);
			break;
		case Tool.Bento4:
			bento4Template(convertDescription);
			break;
		case Tool.MP4Box:
			mp4boxTemplate(convertDescription);
			break;
		case Tool.GPAC:
			gpacTemplate(convertDescription);
			break;
		case Tool.ShakaPackager:
			packagerTemplate(convertDescription);
			break;
	}
};

// 実行開始する
// エラーの場合はログに出力される
main().catch(console.error);