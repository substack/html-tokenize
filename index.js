var Transform = require('readable-stream').Transform;
var inherits = require('inherits');

inherits(Tokenize, Transform);
module.exports = Tokenize;

var codes = {
    lt: '<'.charCodeAt(0),
    gt: '>'.charCodeAt(0),
    slash: '/'.charCodeAt(0),
    dquote: '"'.charCodeAt(0),
    squote: "'".charCodeAt(0)
};


var strings = {
    endScript: Buffer('</script'),
    comment: Buffer('<!--'),
    endComment: Buffer('-->'),
    cdata: Buffer('<![CDATA['),
    endCdata: Buffer(']]>')
};


function Tokenize () {
    if (!(this instanceof Tokenize)) return new Tokenize;
    Transform.call(this, { objectMode: true });
    this._state = this._state_text;
    this.raw = null;
    this.buffers = [];
    this._last = [];
}


Tokenize.prototype._transform = function (buf, enc, next) {
    this.offset = 0;
    this.buf = buf;
    for (this.i = 0; this.i < this.buf.length; this.i++) {
        this.b = this.buf[this.i];
        this._last.push(this.b);
        if (this._last.length > 9) this._last.shift();

        if (this.raw) {
            var parts = this._testRaw(this.buf, this.offset, this.i);
            if (parts) {
                this.push([ 'text', parts[0] ]);

                if (this.raw === strings.endComment
                || this.raw === strings.endCdata) {
                    this._state = this._state_text;
                    this.buffers = [];
                    this.push([ 'close', parts[1] ]);
                }
                else {
                    this._state = this._state_open;
                    this.buffers = [ parts[1] ];
                }

                this.raw = null;
                this.offset = this.i + 1;
            }
        } else {
          this._state();
        }
    }
    if (this.offset < this.buf.length) this.buffers.push(this.buf.slice(this.offset));
    next();
};


Tokenize.prototype._state_text = function () {
  if (this.b === codes.lt) {
      if (this.i > 0 && this.i - this.offset > 0) {
          this.buffers.push(this.buf.slice(this.offset, this.i));
      }
      this.offset = this.i;
      this._state = this._state_open;
      this._pushState('text');
  }
}


Tokenize.prototype._state_single_quote = function () {
  if (this.b === codes.squote) {
      this._state = this._state_open;
  }
}


Tokenize.prototype._state_double_quote = function () {
  if (this.b === codes.dquote) {
      this._state = this._state_open;
  }
}


Tokenize.prototype._state_open = function () {
  if (this.b === codes.dquote) {
      this._state = this._state_double_quote;
  } else if (this.b === codes.squote) {
      this._state = this._state_single_quote;
  } else if (this.b === codes.gt) {
      if (this.i > 0) this.buffers.push(this.buf.slice(this.offset, this.i + 1));
      this.offset = this.i + 1;
      this._state = this._state_text;

      if (this._getChar(1) === codes.slash) {
          this._pushState('close');
      } else {
          if ( this._getTag() === 'script') this.raw = strings.endScript;
          this._pushState('open');
      }
  } else if (compare(this._last, strings.comment)) {
      this.buffers.push(this.buf.slice(this.offset, this.i + 1));
      this.offset = this.i + 1;
      this._state = this._state_text;
      this.raw = strings.endComment;
      this._pushState('open');
  } else if (compare(this._last, strings.cdata)) {
      this.buffers.push(this.buf.slice(this.offset, this.i + 1));
      this.offset = this.i + 1;
      this._state = this._state_text;
      this.raw = strings.endCdata;
      this._pushState('open');
  }
}


Tokenize.prototype._flush = function (next) {
    if (this._state === this._state_text) {
      this._pushState('text');
    }
    this.push(null);
    next();
};

Tokenize.prototype._pushState = function (ev) {
    if (this.buffers.length === 0) return;
    var buf = Buffer.concat(this.buffers);
    this.buffers = [];
    this.push([ ev, buf ]);
};

Tokenize.prototype._getChar = function (i) {
    var offset = 0;
    for (var j = 0; j < this.buffers.length; j++) {
        var buf = this.buffers[j];
        if (offset + buf.length > i) {
            return buf[i - offset];
        }
        offset += buf;
    }
};

Tokenize.prototype._getTag = function () {
    var offset = 0;
    var tag = '';
    for (var j = 0; j < this.buffers.length; j++) {
        var buf = this.buffers[j];
        for (var k = 0; k < buf.length; k++) {
            if (offset === 0 && k === 0) continue;
            var c = String.fromCharCode(buf[k]);
            if (/[^\w-!\[\]]/.test(c)) {
                return tag.toLowerCase();
            }
            else tag += c;
        }
        offset += buf.length;
    }
};

Tokenize.prototype._testRaw = function (buf, offset, index) {
    var raw = this.raw, last = this._last;
    if (!compare(last, raw)) return;

    this.buffers.push(buf.slice(offset, index + 1));
    var buf = Buffer.concat(this.buffers);
    var k = buf.length - raw.length;
    return [ buf.slice(0, k), buf.slice(k) ];
};

function compare (a, b) {
    if (a.length < b.length) return false;
    for (var i=a.length-1, j=b.length-1; i >= 0 && j >= 0; i--, j--) {
        if (lower(a[i]) !== lower(b[j])) return false;
    }
    return true;
}

function lower (n) {
    if (n >= 65 && n <= 90) return n + 32;
    return n;
}
