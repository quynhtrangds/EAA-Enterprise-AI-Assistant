import { describe, it, expect } from 'vitest';
import {
  SearchInputSchema,
  ExternalRagResponseSchema,
  parseAndNormalizeExternalResults,
  sanitizeAndTruncateText,
  MAX_CHUNK_LENGTH,
  MAX_RESPONSE_BYTES
} from './index.js';

describe('RAG MCP Server - Security & Validation Suite', () => {
  describe('SearchInputSchema', () => {
    it('chấp nhận từ khóa hợp lệ', () => {
      const result = SearchInputSchema.safeParse({ keyword: 'chính sách nghỉ phép' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.keyword).toBe('chính sách nghỉ phép');
      }
    });

    it('từ chối từ khóa rỗng hoặc chỉ có khoảng trắng', () => {
      const result1 = SearchInputSchema.safeParse({ keyword: '' });
      expect(result1.success).toBe(false);

      const result2 = SearchInputSchema.safeParse({ keyword: '   ' });
      expect(result2.success).toBe(false);
    });

    it('từ chối từ khóa vượt quá 200 ký tự', () => {
      const longKeyword = 'a'.repeat(201);
      const result = SearchInputSchema.safeParse({ keyword: longKeyword });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain('200 ký tự');
      }
    });

    it('lọc bỏ các ký tự điều khiển ASCII nguy hiểm', () => {
      const dirty = 'hướng dẫn\x00 vpn\x1b';
      const result = SearchInputSchema.safeParse({ keyword: dirty });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.keyword).toBe('hướng dẫn  vpn');
      }
    });
  });

  describe('sanitizeAndTruncateText', () => {
    it('giữ nguyên văn bản ngắn hơn giới hạn MAX_CHUNK_LENGTH', () => {
      const shortText = 'Tài liệu nội bộ thông thường';
      expect(sanitizeAndTruncateText(shortText, MAX_CHUNK_LENGTH)).toBe(shortText);
    });

    it('cắt ngắn văn bản dài hơn MAX_CHUNK_LENGTH và gắn nhãn [đã cắt ngắn]', () => {
      const longText = 'A'.repeat(MAX_CHUNK_LENGTH + 500);
      const truncated = sanitizeAndTruncateText(longText, MAX_CHUNK_LENGTH);
      expect(truncated.length).toBe(MAX_CHUNK_LENGTH + '... [đã cắt ngắn]'.length);
      expect(truncated.endsWith('... [đã cắt ngắn]')).toBe(true);
    });
  });

  describe('parseAndNormalizeExternalResults', () => {
    it('chuẩn hóa định dạng mảng tài liệu từ external API', () => {
      const rawApiData = [
        {
          id: 'doc-ext-1',
          title: 'Quy chế công ty 2026',
          category: 'Pháp chế',
          content: 'Nội dung quy chế công ty'
        }
      ];

      const docs = parseAndNormalizeExternalResults(rawApiData);
      expect(docs.length).toBe(1);
      expect(docs[0].id).toBe('doc-ext-1');
      expect(docs[0].title).toBe('Quy chế công ty 2026');
      expect(docs[0].content).toBe('Nội dung quy chế công ty');
    });

    it('chuẩn hóa định dạng đối tượng có trường documents hoặc results', () => {
      const rawApiData = {
        total: 1,
        documents: [
          {
            id: 99,
            title: 'Sổ tay nhân viên',
            snippet: 'Trích đoạn sổ tay nhân viên'
          }
        ]
      };

      const docs = parseAndNormalizeExternalResults(rawApiData);
      expect(docs.length).toBe(1);
      expect(docs[0].id).toBe('99');
      expect(docs[0].title).toBe('Sổ tay nhân viên');
      expect(docs[0].content).toBe('Trích đoạn sổ tay nhân viên');
    });

    it('cắt ngắn content của tài liệu ngoài nếu vượt quá MAX_CHUNK_LENGTH', () => {
      const oversizedContent = 'X'.repeat(3000);
      const rawApiData = [
        {
          id: 'oversized-doc',
          title: 'Tài liệu siêu dài',
          content: oversizedContent
        }
      ];

      const docs = parseAndNormalizeExternalResults(rawApiData);
      expect(docs[0].content.length).toBe(MAX_CHUNK_LENGTH + '... [đã cắt ngắn]'.length);
      expect(docs[0].content.endsWith('... [đã cắt ngắn]')).toBe(true);
    });

    it('trả về mảng rỗng và không crash khi dữ liệu API ngoài không đúng định dạng', () => {
      const malformedData = 'Not a valid JSON object or array';
      const docs = parseAndNormalizeExternalResults(malformedData);
      expect(docs).toEqual([]);
    });
  });

  describe('Safety Thresholds', () => {
    it('xác nhận hằng số an toàn giới hạn kích thước phản hồi và độ dài chunk', () => {
      expect(MAX_RESPONSE_BYTES).toBe(512 * 1024);
      expect(MAX_CHUNK_LENGTH).toBe(1500);
    });
  });
});
