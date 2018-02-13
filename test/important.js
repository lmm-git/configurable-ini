var i = require("../")
  , tap = require("tap")
  , test = tap.test
  , fs = require("fs")
  , path = require("path")
  , fixture = path.resolve(__dirname, "./fixtures/important.ini")
  , data = fs.readFileSync(fixture, "utf8")

test("decode from file, default comment delimiters", function (t) {
  var d = i.decode(data)
  t.deepEqual(d, {
    'notAtAllImportant': {
      'notImportant': 'yeah1',
      'important': 'yeah2'
    },
    'everythingImportant': {
      'notLabeled': 'yeah3'
    },
    'absolutelyUnimportant': {
      'notInteresting': 'no'
    }
  })
  t.end()
})

test("decode from file, without hashtag delimiter", function (t) {
  var d = i.decode(data, { 'filterComment': 'IMPORTANT' })
  t.deepEqual(d, {
    'notAtAllImportant': {
      'important': 'yeah2'
    },
    'everythingImportant': {
      'notLabeled': 'yeah3'
    }
  })
  t.end()
})
