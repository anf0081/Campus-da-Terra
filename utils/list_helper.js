const dummy = (books) => {
  console.log(books)
  return 1
}

const mostBooks = (books) => {
  const authors = books.map(book => book.author)
  let countBooks = authors.reduce((count, author) => {
    count[author] = (count[author] ?? 0) + 1
    return count
  }, {})
  console.log(countBooks)
  let countBooksArr = Object.entries(countBooks)
  countBooksArr.sort((a, b) => b[1] - a[1])
  const mostAuthor = { author: countBooksArr[0][0], count: countBooksArr[0][1] }
  return mostAuthor
}

module.exports = {
  dummy, mostBooks
}