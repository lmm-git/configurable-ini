exports.parse = exports.decode = decode

exports.stringify = exports.encode = encode

exports.safe = safe
exports.unsafe = unsafe

const DEFAULT_COMMENT_DELIMITERS = [';', '#']

var eol = typeof process !== 'undefined' &&
  process.platform === 'win32' ? '\r\n' : '\n'

function encode (obj, opt) {
  var children = []
  var out = ''

  if (typeof opt === 'string') {
    opt = {
      section: opt,
      whitespace: false,
      commentDelimiters: DEFAULT_COMMENT_DELIMITERS,
      dataComments: true
    }
  } else {
    opt = opt || {}
    opt.whitespace = opt.whitespace === true
    opt.commentDelimiters = opt.commentDelimiters || DEFAULT_COMMENT_DELIMITERS
    opt.dataComments = !(opt.dataComments === false)
  }

  var separator = opt.whitespace ? ' = ' : '='

  Object.keys(obj).forEach(function (k, _, __) {
    var val = obj[k]
    if (val && Array.isArray(val)) {
      val.forEach(function (item) {
        out += safe(k + '[]', opt) + separator + safe(item, opt) + '\n'
      })
    } else if (val && typeof val === 'object') {
      children.push(k)
    } else {
      out += safe(k, opt) + separator + safe(val, opt) + eol
    }
  })

  if (opt.section && out.length) {
    out = '[' + safe(opt.section, opt) + ']' + eol + out
  }

  children.forEach(function (k, _, __) {
    var nk = dotSplit(k).join('\\.')
    var section = (opt.section ? opt.section + '.' : '') + nk
    var child = encode(obj[k], {
      section: section,
      whitespace: opt.whitespace,
      commentDelimiters: opt.commentDelimiters,
      dataComments: opt.dataComments
    })
    if (out.length && child.length) {
      out += eol
    }
    out += child
  })

  return out
}

function dotSplit (str) {
  return str.replace(/\1/g, '\u0002LITERAL\\1LITERAL\u0002')
    .replace(/\\\./g, '\u0001')
    .split(/\./).map(function (part) {
      return part.replace(/\1/g, '\\.')
      .replace(/\2LITERAL\\1LITERAL\2/g, '\u0001')
    })
}

function decode (str, opt) {
  opt = opt || {}
  opt.commentDelimiters = opt.commentDelimiters || DEFAULT_COMMENT_DELIMITERS
  opt.dataComments = !(opt.dataComments === false)
  opt.filterComment = opt.filterComment || null
  var out = {}
  var section = null
  //          section     |key      = value
  var re = /^\[([^\]]*)\]$|^([^=]+)(=(.*))?$/i
  var lines = str.split(/[\r\n]+/g)
  var filterCommentFound = false
  var filterCommentSectionActive = false

  lines.forEach(function (line, _, __) {
    if (!line) {
      return
    }

    if (line.match('^\\s*[' + opt.commentDelimiters.join('') + ']')) {
      if (opt.filterComment !== null) {
        if (line.match('^\\s*[' + opt.commentDelimiters.join('') + '] ?(.*)$')[1] === opt.filterComment) {
          filterCommentFound = true
        }
      }
      return
    }
    var match = line.match(re)
    if (!match) return
    if (match[1] !== undefined) {
      if (filterCommentFound) {
        filterCommentSectionActive = true
        filterCommentFound = false
      } else {
        filterCommentSectionActive = false
      }
      section = unsafe(match[1], opt)
      return
    }
    var key = unsafe(match[2], opt)
    var value = match[3] ? unsafe(match[4], opt) : true
    switch (value) {
      case 'true':
      case 'false':
      case 'null': value = JSON.parse(value)
    }

    if (!opt.filterComment || (filterCommentSectionActive || filterCommentFound)) {
      if (!out[section] && section) {
        out[section] = {}
      }

      var parent = null
      if (section) {
        parent = out[section]
      } else {
        parent = out
      }

      // Convert keys with '[]' suffix to an array
      if (key.length > 2 && key.slice(-2) === '[]') {
        key = key.substring(0, key.length - 2)
        if (!parent[key]) {
          parent[key] = []
        } else if (!Array.isArray(parent[key])) {
          parent[key] = [parent[key]]
        }
      }

      // safeguard against resetting a previously defined
      // array by accidentally forgetting the brackets
      if (Array.isArray(parent[key])) {
        parent[key].push(value)
      } else {
        parent[key] = value
      }

      filterCommentFound = false
    }
  })

  // {a:{y:1},"a.b":{x:2}} --> {a:{y:1,b:{x:2}}}
  // use a filter to return the keys that have to be deleted.
  Object.keys(out).filter(function (k, _, __) {
    if (!out[k] ||
      typeof out[k] !== 'object' ||
      Array.isArray(out[k])) {
      return false
    }
    // see if the parent section is also an object.
    // if so, add it to that, and mark this one for deletion
    var parts = dotSplit(k)
    var p = out
    var l = parts.pop()
    var nl = l.replace(/\\\./g, '.')
    parts.forEach(function (part, _, __) {
      if (!p[part] || typeof p[part] !== 'object') p[part] = {}
      p = p[part]
    })
    if (p === out && nl === l) {
      return false
    }
    p[nl] = out[k]
    return true
  }).forEach(function (del, _, __) {
    delete out[del]
  })

  return out
}

function isQuoted (val) {
  return (val.charAt(0) === '"' && val.slice(-1) === '"') ||
    (val.charAt(0) === "'" && val.slice(-1) === "'")
}

function safe (val, opt) {
  function replaceCommentDelimiters (val, delimList) {
    for (const delimKey in delimList) {
      val = val.replace(new RegExp(delimList[delimKey], 'g'), '\\' + delimList[delimKey])
    }
    return val
  }

  opt = opt || {}
  opt.commentDelimiters = opt.commentDelimiters || DEFAULT_COMMENT_DELIMITERS
  opt.dataComments = !(opt.dataComments === false)
  return (typeof val !== 'string' ||
    val.match(/[=\r\n]/) ||
    val.match(/^\[/) ||
    (val.length > 1 &&
     isQuoted(val)) ||
    val !== val.trim())
      ? JSON.stringify(val)
      : (opt.dataComments ? replaceCommentDelimiters(val, opt.commentDelimiters) : val)
}

function unsafe (val, opt) {
  opt = opt || {}
  opt.commentDelimiters = opt.commentDelimiters || DEFAULT_COMMENT_DELIMITERS
  opt.dataComments = !(opt.dataComments === false)
  val = (val || '').trim()
  if (isQuoted(val)) {
    // remove the single quotes before calling JSON.parse
    if (val.charAt(0) === "'") {
      val = val.substr(1, val.length - 2)
    }
    try { val = JSON.parse(val) } catch (_) {}
  } else {
    // walk the val to find the first not-escaped ; character
    var esc = false
    var unesc = ''
    for (var i = 0, l = val.length; i < l; i++) {
      var c = val.charAt(i)
      if (esc) {
        if (('\\' + opt.commentDelimiters.join('')).indexOf(c) !== -1) {
          unesc += c
        } else {
          unesc += '\\' + c
        }
        esc = false
      } else if (opt.dataComments && opt.commentDelimiters.join('').indexOf(c) !== -1) {
        break
      } else if (c === '\\') {
        esc = true
      } else {
        unesc += c
      }
    }
    if (esc) {
      unesc += '\\'
    }
    return unesc.trim()
  }
  return val
}
