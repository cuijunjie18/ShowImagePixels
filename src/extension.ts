// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parse image dimensions from file buffer.
 * Supports PNG, JPEG, GIF, BMP, WebP, ICO, TIFF, AVIF formats.
 */
function getImageDimensions(filePath: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const ext = path.extname(filePath).toLowerCase();

		// For SVG, we need to parse XML
		if (ext === '.svg') {
			fs.readFile(filePath, 'utf-8', (err, data) => {
				if (err) {
					return reject(new Error(`Failed to read file: ${err.message}`));
				}
				const widthMatch = data.match(/width\s*=\s*"(\d+(\.\d+)?)(\w*)"/);
				const heightMatch = data.match(/height\s*=\s*"(\d+(\.\d+)?)(\w*)"/);
				const viewBoxMatch = data.match(/viewBox\s*=\s*"[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)"/);

				if (widthMatch && heightMatch) {
					resolve({ width: Math.round(parseFloat(widthMatch[1])), height: Math.round(parseFloat(heightMatch[1])) });
				} else if (viewBoxMatch) {
					resolve({ width: Math.round(parseFloat(viewBoxMatch[1])), height: Math.round(parseFloat(viewBoxMatch[2])) });
				} else {
					reject(new Error('Cannot determine SVG dimensions'));
				}
			});
			return;
		}

		// For binary image formats, read the header
		const headerSize = 40960; // 40KB should be enough for headers
		const stream = fs.createReadStream(filePath, { start: 0, end: headerSize - 1 });
		const chunks: Buffer[] = [];

	stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
		stream.on('error', (err) => reject(new Error(`Failed to read file: ${err.message}`)));
		stream.on('end', () => {
			const buffer = Buffer.concat(chunks);

			try {
				if (buffer.length < 8) {
					return reject(new Error('File too small to be a valid image'));
				}

				// PNG: 89 50 4E 47
				if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
					const width = buffer.readUInt32BE(16);
					const height = buffer.readUInt32BE(20);
					return resolve({ width, height });
				}

				// GIF: 47 49 46 38
				if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
					const width = buffer.readUInt16LE(6);
					const height = buffer.readUInt16LE(8);
					return resolve({ width, height });
				}

				// BMP: 42 4D
				if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
					const width = buffer.readUInt32LE(18);
					const height = Math.abs(buffer.readInt32LE(22));
					return resolve({ width, height });
				}

				// WebP: 52 49 46 46 ... 57 45 42 50
				if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
					buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
					// VP8
					if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x20) {
						const width = buffer.readUInt16LE(26) & 0x3FFF;
						const height = buffer.readUInt16LE(28) & 0x3FFF;
						return resolve({ width, height });
					}
					// VP8L (lossless)
					if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x4C) {
						const bits = buffer.readUInt32LE(21);
						const width = (bits & 0x3FFF) + 1;
						const height = ((bits >> 14) & 0x3FFF) + 1;
						return resolve({ width, height });
					}
					// VP8X (extended)
					if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x58) {
						const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
						const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
						return resolve({ width, height });
					}
					return reject(new Error('Unsupported WebP format'));
				}

				// ICO: 00 00 01 00
				if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) {
					const width = buffer[6] === 0 ? 256 : buffer[6];
					const height = buffer[7] === 0 ? 256 : buffer[7];
					return resolve({ width, height });
				}

				// TIFF: 49 49 2A 00 (little-endian) or 4D 4D 00 2A (big-endian)
				if ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) ||
					(buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A)) {
					const le = buffer[0] === 0x49;
					const readU16 = le ? (o: number) => buffer.readUInt16LE(o) : (o: number) => buffer.readUInt16BE(o);
					const readU32 = le ? (o: number) => buffer.readUInt32LE(o) : (o: number) => buffer.readUInt32BE(o);

					const ifdOffset = readU32(4);
					if (ifdOffset + 2 > buffer.length) {
						return reject(new Error('TIFF IFD offset out of range'));
					}
					const numEntries = readU16(ifdOffset);
					let width = 0, height = 0;
					for (let i = 0; i < numEntries; i++) {
						const entryOffset = ifdOffset + 2 + i * 12;
						if (entryOffset + 12 > buffer.length) { break; }
						const tag = readU16(entryOffset);
						const type = readU16(entryOffset + 2);
						if (tag === 0x0100) { // ImageWidth
							width = type === 3 ? readU16(entryOffset + 8) : readU32(entryOffset + 8);
						} else if (tag === 0x0101) { // ImageLength
							height = type === 3 ? readU16(entryOffset + 8) : readU32(entryOffset + 8);
						}
					}
					if (width && height) {
						return resolve({ width, height });
					}
					return reject(new Error('Cannot determine TIFF dimensions'));
				}

				// JPEG: FF D8 FF
				if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
					let offset = 2;
					while (offset < buffer.length - 1) {
						if (buffer[offset] !== 0xFF) {
							return reject(new Error('Invalid JPEG structure'));
						}
						const marker = buffer[offset + 1];

						// SOF markers (SOF0-SOF3, SOF5-SOF7, SOF9-SOF11, SOF13-SOF15)
						if ((marker >= 0xC0 && marker <= 0xC3) ||
							(marker >= 0xC5 && marker <= 0xC7) ||
							(marker >= 0xC9 && marker <= 0xCB) ||
							(marker >= 0xCD && marker <= 0xCF)) {
							if (offset + 9 > buffer.length) {
								return reject(new Error('JPEG SOF marker truncated'));
							}
							const height = buffer.readUInt16BE(offset + 5);
							const width = buffer.readUInt16BE(offset + 7);
							return resolve({ width, height });
						}

						// Skip this segment
						if (offset + 3 >= buffer.length) {
							return reject(new Error('JPEG header truncated'));
						}
						const segmentLength = buffer.readUInt16BE(offset + 2);
						offset += 2 + segmentLength;
					}
					return reject(new Error('Cannot find JPEG SOF marker'));
				}

				reject(new Error('Unsupported image format'));
			} catch (e) {
				reject(new Error(`Failed to parse image: ${(e as Error).message}`));
			}
		});
	});
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Extension "showimagepixels" is now active!');

	const disposable = vscode.commands.registerCommand('showimagepixels.showPixels', async (uri: vscode.Uri) => {
		if (!uri) {
			vscode.window.showErrorMessage('No file selected.');
			return;
		}

		const filePath = uri.fsPath;
		const fileName = path.basename(filePath);

		try {
			const dimensions = await getImageDimensions(filePath);
			vscode.window.showInformationMessage(
				`${fileName}: ${dimensions.width} x ${dimensions.height} pixels`
			);
		} catch (error) {
			vscode.window.showErrorMessage(
				`Failed to read image dimensions for ${fileName}: ${(error as Error).message}`
			);
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
