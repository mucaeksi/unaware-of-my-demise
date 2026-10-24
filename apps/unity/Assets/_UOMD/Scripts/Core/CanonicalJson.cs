#nullable enable
using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace Uomd.Core
{
    /// <summary>
    /// Bit-exact C# port of packages/shared/src/canonical.ts and packages/shared/src/hash.ts.
    /// Produces identical UTF-16 code-unit sorted JSON strings and SHA-256 hex digests so client
    /// battle logs, operation input hashes, and ES256 manifest payloads match the Cloudflare Worker server.
    /// </summary>
    public static class CanonicalJson
    {
        public static string Serialize(object? value)
        {
            var sb = new StringBuilder(256);
            WriteValue(sb, value);
            return sb.ToString();
        }

        private static void WriteValue(StringBuilder sb, object? value)
        {
            if (value is null)
            {
                sb.Append("null");
                return;
            }

            switch (value)
            {
                case string s:
                    WriteEscapedString(sb, s);
                    return;
                case bool b:
                    sb.Append(b ? "true" : "false");
                    return;
                case int i:
                    sb.Append(i.ToString(CultureInfo.InvariantCulture));
                    return;
                case long l:
                    sb.Append(l.ToString(CultureInfo.InvariantCulture));
                    return;
                case uint u:
                    sb.Append(u.ToString(CultureInfo.InvariantCulture));
                    return;
                case double d:
                    if (double.IsNaN(d) || double.IsInfinity(d))
                        throw new InvalidOperationException("CanonicalJson: non-finite number");
                    sb.Append(FormatJsNumber(d));
                    return;
                case float f:
                    WriteValue(sb, (double)f);
                    return;
                case IDictionary<string, object?> dict:
                    WriteObject(sb, dict);
                    return;
                case IEnumerable enumerable:
                    sb.Append('[');
                    bool firstElem = true;
                    foreach (object? item in enumerable)
                    {
                        if (!firstElem) sb.Append(',');
                        firstElem = false;
                        WriteValue(sb, item);
                    }
                    sb.Append(']');
                    return;
                default:
                    throw new InvalidOperationException($"CanonicalJson: unsupported type {value.GetType().FullName}");
            }
        }

        private static void WriteObject(StringBuilder sb, IDictionary<string, object?> dict)
        {
            // TS drops only `undefined`; JSON null values are kept (`{"a":null}`).
            var keys = new List<string>(dict.Keys);
            // JavaScript `<` / `>` string comparison is lexicographical over UTF-16 code units (StringComparer.Ordinal)
            keys.Sort(StringComparer.Ordinal);

            sb.Append('{');
            for (int i = 0; i < keys.Count; i++)
            {
                if (i > 0) sb.Append(',');
                string k = keys[i];
                WriteEscapedString(sb, k);
                sb.Append(':');
                WriteValue(sb, dict[k]);
            }
            sb.Append('}');
        }

        /// <summary>ECMAScript Number::toString(10): shortest round-trip digits, exponent form outside [1e-7, 1e21).</summary>
        public static string FormatJsNumber(double d)
        {
            if (d == 0) return "0"; // also -0
            string e = d.ToString("E16", CultureInfo.InvariantCulture);
            for (int p = 1; p <= 17; p++)
            {
                string candidate = d.ToString("E" + (p - 1).ToString(CultureInfo.InvariantCulture), CultureInfo.InvariantCulture);
                if (double.Parse(candidate, NumberStyles.Float, CultureInfo.InvariantCulture) == d)
                {
                    e = candidate;
                    break;
                }
            }

            bool negative = e[0] == '-';
            if (negative) e = e.Substring(1);
            int ePos = e.IndexOf('E');
            string digits = e.Substring(0, ePos).Replace(".", "").TrimEnd('0');
            if (digits.Length == 0) digits = "0";
            int n = int.Parse(e.Substring(ePos + 1), NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture) + 1;
            int k = digits.Length;

            var sb = new StringBuilder(32);
            if (negative) sb.Append('-');
            if (k <= n && n <= 21)
            {
                sb.Append(digits).Append('0', n - k);
            }
            else if (0 < n && n <= 21)
            {
                sb.Append(digits, 0, n).Append('.').Append(digits, n, k - n);
            }
            else if (-6 < n && n <= 0)
            {
                sb.Append("0.").Append('0', -n).Append(digits);
            }
            else
            {
                int exp = n - 1;
                sb.Append(digits[0]);
                if (k > 1) sb.Append('.').Append(digits, 1, k - 1);
                sb.Append('e').Append(exp < 0 ? '-' : '+').Append(Math.Abs(exp).ToString(CultureInfo.InvariantCulture));
            }
            return sb.ToString();
        }

        public static void WriteEscapedString(StringBuilder sb, string s)
        {
            sb.Append('"');
            for (int i = 0; i < s.Length; i++)
            {
                char c = s[i];
                switch (c)
                {
                    case '"':
                        sb.Append("\\\"");
                        break;
                    case '\\':
                        sb.Append("\\\\");
                        break;
                    case '\b':
                        sb.Append("\\b");
                        break;
                    case '\f':
                        sb.Append("\\f");
                        break;
                    case '\n':
                        sb.Append("\\n");
                        break;
                    case '\r':
                        sb.Append("\\r");
                        break;
                    case '\t':
                        sb.Append("\\t");
                        break;
                    default:
                        bool loneSurrogate =
                            (char.IsHighSurrogate(c) && !(i + 1 < s.Length && char.IsLowSurrogate(s[i + 1]))) ||
                            (char.IsLowSurrogate(c) && !(i > 0 && char.IsHighSurrogate(s[i - 1])));
                        if (c < 0x20 || loneSurrogate) // well-formed JSON.stringify escapes lone surrogates
                        {
                            sb.Append("\\u");
                            sb.Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        }
                        else
                        {
                            sb.Append(c);
                        }
                        break;
                }
            }
            sb.Append('"');
        }
    }

    public static class Sha256Hash
    {
        public static string ComputeHex(string utf8Text)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(utf8Text);
            return ComputeHex(bytes);
        }

        public static string ComputeHex(byte[] data)
        {
            using var sha = SHA256.Create();
            byte[] digest = sha.ComputeHash(data);
            return ToLowerHex(digest);
        }

        public static string ComputeFileHex(string filePath)
        {
            using var sha = SHA256.Create();
            using var stream = File.OpenRead(filePath);
            byte[] digest = sha.ComputeHash(stream);
            return ToLowerHex(digest);
        }

        public static string ToLowerHex(byte[] bytes)
        {
            char[] chars = new char[bytes.Length * 2];
            const string hexAlphabet = "0123456789abcdef";
            for (int i = 0; i < bytes.Length; i++)
            {
                byte b = bytes[i];
                chars[i * 2] = hexAlphabet[b >> 4];
                chars[i * 2 + 1] = hexAlphabet[b & 0x0F];
            }
            return new string(chars);
        }

        public static byte[] Base64UrlDecode(string input)
        {
            string padded = input.Replace('-', '+').Replace('_', '/');
            int mod = padded.Length % 4;
            if (mod == 2) padded += "==";
            else if (mod == 3) padded += "=";
            return Convert.FromBase64String(padded);
        }

        public static string Base64UrlEncode(byte[] data)
        {
            return Convert.ToBase64String(data)
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');
        }
    }
}
