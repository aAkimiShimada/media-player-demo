// このファイルでは EME 関連の各種ユーティリティを実装している

/** `ArrayBuffer` を文字列に変換する */
export const arrayBufferToString = (arr: ArrayBuffer): string => {
	var view = new Uint8Array(arr);
	return String.fromCharCode(...view);
};

const encoder = new TextEncoder();

/** 文字列を `ArrayBuffer` に変換する */
export const stringToArrayBuffer = (str: string): ArrayBuffer => {
	return encoder.encode(str).buffer;
};

/** Base64文字列をバイナリ文字列に変換する */
const base64ToBinary = (b64: string): string => (
	// + / の代わりに - _ を使っている場合は + / に変換した上でデコードする
	atob(
		b64
		.replace(/-/g, "+")
		.replace(/_/g, "/")
	)
);

/** 16進数文字列をバイナリ文字列に変換する */
const hexToBinary = (hex: string): string => {
	// 文字列を2文字ごとに分割する
	const charArrays = Array.from(hex.match(/.{2}/g));

	// 2文字を16進数の値としてバイナリに変換する
	const binary =
		charArrays
		.map((hexChars) => {
			const code = parseInt(hexChars,16);
			return String.fromCharCode(code);
		}).join("");

	return binary;
};

/** バイナリ文字列をBase64文字列に変換する */
const binaryToBase64 = (binary: string): string => (
	btoa(binary)
		.replace(/=+$/, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
);

/** バイナリ文字列を16進数の文字列に変換する */
export const binaryToHex = (binary: string): string => {
	// バイナリ文字列を配列に
	const byteArray = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
	  byteArray[i] = binary.charCodeAt(i);
	}
	// 16進数に変換
	return Array.from(byteArray)
	.map(
		(byte) => byte.toString(16).padStart(2, "0")
	) // 16進数で2桁に揃える
	.join("");
};

/** Base64文字列を16進数の文字列に変換する */
export const base64ToHex = (b64: string): string => {
	const binary = base64ToBinary(b64);
	return binaryToHex(binary);
};

/** 16進数の文字列をBase64文字列に変換する */
export const hexToBase64 = (hex: string): string => {
	const binary = hexToBinary(hex);
	return binaryToBase64(binary);
};



/** 暗号化キーのペアを表す型 */
export interface KeyPair {
	/** 16進数の形で指定されたキーID */
	keyId: string;
	/** 16進数の形で指定されたキー */
	key: string;
};

/**
 * 暗号化キーを規定する型
 *
 * 映像部分と音声部分で別々にキーペアが指定できるようになっている。 (以後の実装を見ると明らかだが、映像と音声を逆に指定しても特に問題は発生しない)
 */
export interface EncryptionKeys {
	/** 映像部分の暗号化キーペア */
	video: KeyPair;
	/** 音声部分の暗号化キーペア */
	audio: KeyPair;
};