import test from 'node:test'
import assert from 'node:assert/strict'
import { generationTextVi } from '../src/lib/generationTextVi.ts'

test('generationTextVi: 精确译文', () => {
  assert.equal(generationTextVi('My tasks'), 'Tác vụ của tôi')
  assert.equal(generationTextVi('en-US'), 'vi-VN')
})

test('generationTextVi: 模板按位替换', () => {
  assert.equal(generationTextVi('Page 2 of 5'), 'Trang 2/5')
  assert.equal(generationTextVi('3 images / 2 videos / 1 audio clips · 6 total'), '3 ảnh / 2 video / 1 âm thanh · tổng 6')
  assert.equal(generationTextVi(' · ~4 sec'), ' · ~4 giây')
  assert.equal(generationTextVi('Remove reference'), 'Bỏ tham chiếu')
})

test('generationTextVi: 未收录回退英文', () => {
  assert.equal(generationTextVi('Something unknown'), 'Something unknown')
})

test('generationTextVi: 数字占位不误伤普通英文', () => {
  assert.equal(generationTextVi('3m 29s'), '3 phút 29 giây')
  assert.equal(generationTextVi('45s'), '45 giây')
  assert.equal(generationTextVi('Unknown labels'), 'Unknown labels')
  assert.equal(generationTextVi('Remove reference'), 'Bỏ tham chiếu')
})
