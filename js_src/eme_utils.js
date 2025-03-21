// このファイルでは EME 関連の各種ユーティリティを実装している

/** `ArrayBuffer` を文字列に変換する */
export const arrayBufferToString = arr => {
	var view = new Uint8Array(arr);
	return String.fromCharCode(...view);
};
const encoder = new TextEncoder();

/** 文字列を `ArrayBuffer` に変換する */
export const stringToArrayBuffer = str => {
	return encoder.encode(str).buffer;
};

/** Base64文字列をバイナリ文字列に変換する */
const base64ToBinary = b64 =>
// + / の代わりに - _ を使っている場合は + / に変換した上でデコードする
atob(b64.replace(/-/g, "+").replace(/_/g, "/"));

/** 16進数文字列をバイナリ文字列に変換する */
const hexToBinary = hex => {
	// 文字列を2文字ごとに分割する
	const charArrays = Array.from(hex.match(/.{2}/g));

	// 2文字を16進数の値としてバイナリに変換する
	const binary = charArrays.map(hexChars => {
		const code = parseInt(hexChars, 16);
		return String.fromCharCode(code);
	}).join("");
	return binary;
};

/** バイナリ文字列をBase64文字列に変換する */
const binaryToBase64 = binary => btoa(binary).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** バイナリ文字列を16進数の文字列に変換する */
export const binaryToHex = binary => {
	// バイナリ文字列を配列に
	const byteArray = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		byteArray[i] = binary.charCodeAt(i);
	}
	// 16進数に変換
	return Array.from(byteArray).map(byte => byte.toString(16).padStart(2, "0")) // 16進数で2桁に揃える
	.join("");
};

/** Base64文字列を16進数の文字列に変換する */
export const base64ToHex = b64 => {
	const binary = base64ToBinary(b64);
	return binaryToHex(binary);
};

/** 16進数の文字列をBase64文字列に変換する */
export const hexToBase64 = hex => {
	const binary = hexToBinary(hex);
	return binaryToBase64(binary);
};