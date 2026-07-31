import { describe, it, expect } from 'vitest';
import { removeAccents, MOCK_DOCUMENTS } from './index.js';

describe('mcp-server-rag Unit & Document Search Tests', () => {
  describe('removeAccents helper', () => {
    it('strips Vietnamese diacritics', () => {
      expect(removeAccents('Chính sách nghỉ phép năm 2026')).toBe('Chinh sach nghi phep nam 2026');
      expect(removeAccents('Quy trình xử lý sự cố')).toBe('Quy trinh xu ly su co');
    });

    it('handles đ and Đ properly', () => {
      expect(removeAccents('đơn hàng Đã thanh toán')).toBe('don hang Da thanh toan');
    });
  });

  describe('MOCK_DOCUMENTS & Search Logic', () => {
    it('contains expected mock policy documents', () => {
      expect(MOCK_DOCUMENTS).toHaveLength(4);
      expect(MOCK_DOCUMENTS[0].title).toBe('Chính sách nghỉ phép năm 2026');
    });

    it('filters documents correctly based on normalized keyword', () => {
      const keyword = removeAccents('vpn');
      const results = MOCK_DOCUMENTS.filter(doc =>
        removeAccents(doc.title.toLowerCase()).includes(keyword) ||
        removeAccents(doc.content.toLowerCase()).includes(keyword)
      );
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc-002');
    });
  });
});
