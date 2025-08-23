package fragmentArguments

import (
	"math/bits"
	"unicode/utf16"
)

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

// murmurHash takes a UTF‑8 string, encodes it as UTF‑16, and returns a base62 murmur hash.
func murmurHash(s string) string {
	// Convert the input string into UTF‑16 code units.
	codeUnits := utf16.Encode([]rune(s))
	length := len(codeUnits)
	rem := length & 3
	// Using length - rem is equivalent to what the JavaScript code does with XOR.
	len4 := length - rem

	var h uint32 = 0
	var k uint32
	i := 0

	// Process 4 code units at a time.
	for i < len4 {
		// Grab the 4th code unit.
		ch4 := codeUnits[i+3]

		// Combine the four code units into one 32‑bit integer.
		k = uint32(codeUnits[i]) ^
			(uint32(codeUnits[i+1]) << 8) ^
			(uint32(codeUnits[i+2]) << 16) ^
			((uint32(ch4) & 0xff) << 24) ^
			((uint32(ch4) & 0xff00) >> 8)
		i += 4

		k = k*0x2d51 + (k&0xffff)*0xcc9e0000
		k = bits.RotateLeft32(k, 15)
		k = k*0x3593 + (k&0xffff)*0x1b870000
		h ^= k
		h = bits.RotateLeft32(h, 13)
		h = h*5 + 0xe6546b64
	}

	// Process any remaining code units.
	k = 0
	switch rem {
	case 3:
		k ^= uint32(codeUnits[len4+2]) << 16
		fallthrough
	case 2:
		k ^= uint32(codeUnits[len4+1]) << 8
		fallthrough
	case 1:
		k ^= uint32(codeUnits[len4])
		k = k*0x2d51 + (k&0xffff)*0xcc9e0000
		k = bits.RotateLeft32(k, 15)
		k = k*0x3593 + (k&0xffff)*0x1b870000
		h ^= k
	}

	// Finalization mix.
	h ^= uint32(length)
	h ^= h >> 16
	h = h*0xca6b + (h&0xffff)*0x85eb0000
	h ^= h >> 13
	h = h*0xae35 + (h&0xffff)*0xc2b20000
	h ^= h >> 16

	if h == 0 {
		return "0"
	}

	// Convert the final hash to a base62 string.
	var result string
	for h > 0 {
		d := h % 62
		result = string(BASE62[d]) + result
		h /= 62
	}

	return result
}
