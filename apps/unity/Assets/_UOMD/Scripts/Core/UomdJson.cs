#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Uomd.Core
{
    /// <summary>
    /// Minimal strict JSON reader producing the plain object graph CanonicalJson/Es256SignatureVerifier expect:
    /// Dictionary&lt;string, object?&gt;, List&lt;object?&gt;, string, bool, long (safe integers) or double, null.
    /// JsonUtility cannot read dictionaries or keep unknown fields, which signature verification requires.
    /// </summary>
    public static class UomdJson
    {
        private const double MaxSafeInteger = 9007199254740991.0;

        public static object? Parse(string json)
        {
            if (json == null) throw new ArgumentNullException(nameof(json));
            int i = 0;
            object? value = ReadValue(json, ref i);
            SkipWhitespace(json, ref i);
            if (i != json.Length) throw Error(json, i, "trailing characters");
            return value;
        }

        public static Dictionary<string, object?> ParseObject(string json)
        {
            return Parse(json) as Dictionary<string, object?> ?? throw new FormatException("UomdJson: expected a JSON object");
        }

        private static object? ReadValue(string s, ref int i)
        {
            SkipWhitespace(s, ref i);
            if (i >= s.Length) throw Error(s, i, "unexpected end");
            char c = s[i];
            switch (c)
            {
                case '{': return ReadObject(s, ref i);
                case '[': return ReadArray(s, ref i);
                case '"': return ReadString(s, ref i);
                case 't': Expect(s, ref i, "true"); return true;
                case 'f': Expect(s, ref i, "false"); return false;
                case 'n': Expect(s, ref i, "null"); return null;
                default:
                    if (c == '-' || (c >= '0' && c <= '9')) return ReadNumber(s, ref i);
                    throw Error(s, i, $"unexpected '{c}'");
            }
        }

        private static Dictionary<string, object?> ReadObject(string s, ref int i)
        {
            var obj = new Dictionary<string, object?>(StringComparer.Ordinal);
            i++; // {
            SkipWhitespace(s, ref i);
            if (i < s.Length && s[i] == '}') { i++; return obj; }
            while (true)
            {
                SkipWhitespace(s, ref i);
                if (i >= s.Length || s[i] != '"') throw Error(s, i, "expected key");
                string key = ReadString(s, ref i);
                SkipWhitespace(s, ref i);
                if (i >= s.Length || s[i] != ':') throw Error(s, i, "expected ':'");
                i++;
                obj[key] = ReadValue(s, ref i); // duplicate keys: last wins, like JSON.parse
                SkipWhitespace(s, ref i);
                if (i >= s.Length) throw Error(s, i, "unterminated object");
                if (s[i] == ',') { i++; continue; }
                if (s[i] == '}') { i++; return obj; }
                throw Error(s, i, "expected ',' or '}'");
            }
        }

        private static List<object?> ReadArray(string s, ref int i)
        {
            var list = new List<object?>();
            i++; // [
            SkipWhitespace(s, ref i);
            if (i < s.Length && s[i] == ']') { i++; return list; }
            while (true)
            {
                list.Add(ReadValue(s, ref i));
                SkipWhitespace(s, ref i);
                if (i >= s.Length) throw Error(s, i, "unterminated array");
                if (s[i] == ',') { i++; continue; }
                if (s[i] == ']') { i++; return list; }
                throw Error(s, i, "expected ',' or ']'");
            }
        }

        private static string ReadString(string s, ref int i)
        {
            i++; // opening quote
            var sb = new StringBuilder();
            while (i < s.Length)
            {
                char c = s[i++];
                if (c == '"') return sb.ToString();
                if (c < 0x20) throw Error(s, i - 1, "control character in string");
                if (c != '\\') { sb.Append(c); continue; }
                if (i >= s.Length) break;
                char esc = s[i++];
                switch (esc)
                {
                    case '"': sb.Append('"'); break;
                    case '\\': sb.Append('\\'); break;
                    case '/': sb.Append('/'); break;
                    case 'b': sb.Append('\b'); break;
                    case 'f': sb.Append('\f'); break;
                    case 'n': sb.Append('\n'); break;
                    case 'r': sb.Append('\r'); break;
                    case 't': sb.Append('\t'); break;
                    case 'u':
                        if (i + 4 > s.Length) throw Error(s, i, "bad \\u escape");
                        sb.Append((char)int.Parse(s.Substring(i, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                        i += 4;
                        break;
                    default: throw Error(s, i - 1, "bad escape");
                }
            }
            throw Error(s, i, "unterminated string");
        }

        private static object ReadNumber(string s, ref int i)
        {
            int start = i;
            if (s[i] == '-') i++;
            while (i < s.Length && "0123456789+-.eE".IndexOf(s[i]) >= 0) i++;
            string text = s.Substring(start, i - start);
            if (!double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out double d) || double.IsInfinity(d))
            {
                throw Error(s, start, $"bad number '{text}'");
            }
            if (d == Math.Floor(d) && Math.Abs(d) <= MaxSafeInteger) return (long)d;
            return d;
        }

        private static void Expect(string s, ref int i, string literal)
        {
            if (string.CompareOrdinal(s, i, literal, 0, literal.Length) != 0) throw Error(s, i, $"expected {literal}");
            i += literal.Length;
        }

        private static void SkipWhitespace(string s, ref int i)
        {
            while (i < s.Length && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r')) i++;
        }

        private static FormatException Error(string s, int i, string message)
        {
            return new FormatException($"UomdJson: {message} at offset {i}");
        }
    }
}
