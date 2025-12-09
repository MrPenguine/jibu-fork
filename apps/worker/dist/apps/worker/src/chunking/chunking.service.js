"use strict";
var ChunkingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChunkingService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const textsplitters_1 = require("@langchain/textsplitters");
let ChunkingService = ChunkingService_1 = class ChunkingService {
    constructor() {
        this.logger = new common_1.Logger(ChunkingService_1.name);
        this.textSplitter = new textsplitters_1.RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
            separators: [
                "\n\n",
                "\n",
                ". ",
                "! ",
                "? ",
                ";",
                ":",
                " ",
                "",
            ],
        });
        this.pdfSplitter = new textsplitters_1.RecursiveCharacterTextSplitter({
            chunkSize: 800,
            chunkOverlap: 150,
            separators: [
                "\n\n\n",
                "\n\n",
                "\n",
                ". ",
                ".\n",
                "! ",
                "? ",
                ";\n",
                "; ",
                ":\n",
                ": ",
                " - ",
                ", ",
                " ",
                "",
            ],
            keepSeparator: true,
        });
        this.logger.log('ChunkingService initialized with specialized splitters for different content types');
    }
    async splitTextIntoChunks(text, mimeType) {
        this.logger.log(`Splitting text of length ${text.length} into chunks${mimeType ? ` (mime: ${mimeType})` : ''}`);
        try {
            if (!text || text.length < 10) {
                this.logger.warn('Text is too short, returning single chunk');
                return [text || ''];
            }
            const isPdfContent = (mimeType === null || mimeType === void 0 ? void 0 : mimeType.includes('pdf')) ||
                this.containsPdfPatterns(text);
            const isBinaryLike = this.containsBinaryPatterns(text);
            if (isBinaryLike) {
                this.logger.warn('Text appears to contain binary data, using safe chunking mode');
                return this.splitByLength(text, 800, 100);
            }
            const splitter = isPdfContent ? this.pdfSplitter : this.textSplitter;
            this.logger.debug(`Using ${isPdfContent ? 'PDF' : 'standard'} text splitter`);
            const documents = await splitter.createDocuments([text]);
            const chunks = documents.map(doc => doc.pageContent);
            this.logger.log(`Successfully split text into ${chunks.length} chunks`);
            const processedChunks = isPdfContent ?
                chunks.map(chunk => this.postProcessPdfChunk(chunk)) :
                chunks;
            return processedChunks;
        }
        catch (error) {
            this.logger.error(`Error splitting text: ${error.message}`);
            this.logger.warn('Falling back to simple splitting method');
            return this.splitByLength(text, 800, 100);
        }
    }
    postProcessPdfChunk(chunk) {
        return chunk
            .replace(/\/([\w]+)(?=[\s\d])/g, '')
            .replace(/[<>]/g, ' ')
            .replace(/^\d+\s*$/gm, '')
            .replace(/\b(obj|endobj|stream|endstream|xref|trailer|startxref)\b/g, ' ')
            .replace(/\b(Tj|TJ|Td|TD|Tf|Tc|Tw|Tz|BT|ET|cm|gs|re|q|Q|Do)\b/g, ' ')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            .replace(/(?:\\x[0-9a-f]{2}|\\u[0-9a-f]{4})+/gi, ' ')
            .replace(/\f/g, '\n')
            .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    splitByLength(text, chunkSize, overlap) {
        if (!text)
            return [''];
        const chunks = [];
        let startIndex = 0;
        while (startIndex < text.length) {
            const endIndex = Math.min(startIndex + chunkSize, text.length);
            chunks.push(text.substring(startIndex, endIndex));
            startIndex += chunkSize - overlap;
        }
        this.logger.log(`Split text into ${chunks.length} chunks using simple length-based splitting`);
        return chunks;
    }
    containsPdfPatterns(text) {
        const pdfPatterns = [
            /Page \d+ of \d+/i,
            /^\s*\d+\s*$/m,
            /©.*\d{4}/,
            /Figure \d+:/i,
            /Table \d+:/i,
            /References:/i,
            /et al\./i,
            /^\s*\d+\s*$/m,
            /^Contents$/m,
            /^Index$/m,
            /^Appendix [A-Z]$/m,
        ];
        return pdfPatterns.some(pattern => pattern.test(text));
    }
    containsBinaryPatterns(text) {
        if (text.includes('%PDF-'))
            return true;
        const controlCharCount = (text.match(/[\x00-\x1F\x7F-\x9F]/g) || []).length;
        const controlCharRatio = controlCharCount / text.length;
        if (controlCharRatio > 0.05)
            return true;
        const nonAsciiCount = (text.match(/[^\x20-\x7E\xA0-\xFF\s]/g) || []).length;
        const nonAsciiRatio = nonAsciiCount / text.length;
        if (nonAsciiRatio > 0.1)
            return true;
        if (/(?:hÞ|ÂÃ|Ø×|õô)/i.test(text))
            return true;
        const commonBinarySigs = [
            'PK\x03\x04',
            '\x89PNG',
            'GIF8',
            '\xff\xd8\xff',
            '%!PS',
            'BM',
            'obj',
            'endobj',
            'stream',
            'endstream'
        ];
        for (const sig of commonBinarySigs) {
            if (text.includes(sig))
                return true;
        }
        return false;
    }
    setChunkParameters(chunkSize, chunkOverlap) {
        this.logger.log(`Updating chunk parameters: size=${chunkSize}, overlap=${chunkOverlap}`);
        this.textSplitter.chunkSize = chunkSize;
        this.textSplitter.chunkOverlap = chunkOverlap;
        this.pdfSplitter.chunkSize = Math.floor(chunkSize * 0.8);
        this.pdfSplitter.chunkOverlap = Math.floor(chunkOverlap * 1.25);
    }
};
exports.ChunkingService = ChunkingService;
exports.ChunkingService = ChunkingService = ChunkingService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [])
], ChunkingService);
//# sourceMappingURL=chunking.service.js.map