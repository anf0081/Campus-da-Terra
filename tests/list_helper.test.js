const { test, describe } = require('node:test')
const assert = require('node:assert')
const listHelper = require('../utils/list_helper')

const booksNull = []

const books = [
  {
    title: 'Book 1',
    author: 'Anon 1',
    url: 'https://example1.com/',
    userId: '68c75c16961f1fb31cdd512d'
  },
  {
    title: 'Book 2',
    author: 'Anon 2',
    url: 'https://example2.com/',
    userId: '68c75c16961f1fb31cdd512d'
  },
  {
    title: 'Book 3',
    author: 'Anon 3',
    url: 'https://example3.com/',
    userId: '68c75c16961f1fb31cdd512d'
  },
  {
    title: 'Book 4',
    author: 'Anon 2',
    url: 'https://example4.com/',
    userId: '68c75c16961f1fb31cdd512d'
  },
  {
    title: 'Book 5',
    author: 'Anon 2',
    url: 'https://example5.com/',
    userId: '68c75c16961f1fb31cdd512d'
  },
  {
    title: 'Book 6',
    author: 'Anon 3',
    url: 'https://example6.com/',
    userId: '68c75c16961f1fb31cdd512d'
  }
]

describe('dummy', () => {
  test('dummy returns one', () => {
    const result = listHelper.dummy(booksNull)
    assert.strictEqual(result, 1)
  })
})

describe('most Books', () => {
  test('returns the author with most books', () => {
    const expected = { author: 'Anon 2', count: 3 }
    const result = listHelper.mostBooks(books)
    assert.deepStrictEqual(result, expected)
  })
})