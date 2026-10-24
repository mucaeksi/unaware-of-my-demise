#nullable enable
using System;
using System.Collections.Generic;
using System.Numerics;
using System.Security.Cryptography;
using System.Text;

namespace Uomd.Core
{
    public readonly struct Es256SignatureEnvelope
    {
        public readonly string Kid;
        public readonly string Alg;
        public readonly string Value;

        public Es256SignatureEnvelope(string kid, string alg, string value)
        {
            Kid = kid;
            Alg = alg;
            Value = value;
        }
    }

    /// <summary>
    /// Bit-exact C# port of packages/shared/src/signing.ts.
    /// Verifies ECDSA P-256 / SHA-256 (ES256, IEEE P1363 64-byte R||S encoding) signatures over
    /// CanonicalJson(payload without "signature") against UomdClientConfig.TrustedPublicKeys.
    /// Uses a managed P-256 implementation because System.Security.Cryptography.ECDsa is not
    /// available in Unity's Mono/IL2CPP class libraries (Android).
    /// </summary>
    public static class Es256SignatureVerifier
    {
        public static bool VerifyPayload(
            IDictionary<string, object?> unsignedPayload,
            Es256SignatureEnvelope signature,
            IReadOnlyList<TrustKeyJwk>? trustedKeys = null)
        {
            return VerifySignedPayload(unsignedPayload, signature.Kid, signature.Alg, signature.Value, trustedKeys);
        }

        public static bool VerifySignedPayload(
            IDictionary<string, object?> payload,
            string signatureKid,
            string signatureAlg,
            string signatureBase64Url,
            IReadOnlyList<TrustKeyJwk>? trustedKeys = null)
        {
            if (payload == null ||
                string.IsNullOrEmpty(signatureKid) ||
                !string.Equals(signatureAlg, "ES256", StringComparison.Ordinal) ||
                string.IsNullOrEmpty(signatureBase64Url))
            {
                return false;
            }

            IReadOnlyList<TrustKeyJwk> roots = trustedKeys ?? UomdClientConfig.TrustedPublicKeys;
            if (roots.Count < 1 || roots.Count > 8) return false;

            TrustKeyJwk? matchedKey = null;
            for (int i = 0; i < roots.Count; i++)
            {
                if (string.Equals(roots[i].Kid, signatureKid, StringComparison.Ordinal))
                {
                    matchedKey = roots[i];
                    break;
                }
            }

            if (matchedKey is null) return false;
            TrustKeyJwk jwk = matchedKey.Value;

            if (jwk.Kty != "EC" || jwk.Crv != "P-256" || jwk.X == null || jwk.Y == null || jwk.X.Length != 43 || jwk.Y.Length != 43)
            {
                return false;
            }

            try
            {
                var unsignedCopy = new Dictionary<string, object?>(payload.Count, StringComparer.Ordinal);
                foreach (var kv in payload)
                {
                    if (!string.Equals(kv.Key, "signature", StringComparison.Ordinal))
                    {
                        unsignedCopy[kv.Key] = kv.Value;
                    }
                }

                byte[] signingInput = Encoding.UTF8.GetBytes(CanonicalJson.Serialize(unsignedCopy));
                byte[] sigBytes = Sha256Hash.Base64UrlDecode(signatureBase64Url);
                if (sigBytes.Length != 64) return false; // IEEE P1363 P-256 signature is 32-byte R + 32-byte S

                byte[] xBytes = Sha256Hash.Base64UrlDecode(jwk.X);
                byte[] yBytes = Sha256Hash.Base64UrlDecode(jwk.Y);
                if (xBytes.Length != 32 || yBytes.Length != 32) return false;

                byte[] digest;
                using (var sha = SHA256.Create())
                {
                    digest = sha.ComputeHash(signingInput);
                }

                return P256.Verify(digest, sigBytes, xBytes, yBytes);
            }
            catch
            {
                return false;
            }
        }
    }

    /// <summary>Minimal managed NIST P-256 ECDSA verification (public data only; no constant-time requirement).</summary>
    internal static class P256
    {
        private static readonly BigInteger P = Hex("FFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF");
        private static readonly BigInteger B = Hex("5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B");
        private static readonly BigInteger N = Hex("FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551");
        private static readonly BigInteger Gx = Hex("6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296");
        private static readonly BigInteger Gy = Hex("4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5");

        private readonly struct Jac
        {
            public readonly BigInteger X, Y, Z;
            public Jac(BigInteger x, BigInteger y, BigInteger z) { X = x; Y = y; Z = z; }
            public bool IsInfinity => Z.IsZero;
        }

        public static bool Verify(byte[] digest, byte[] sigP1363, byte[] qx, byte[] qy)
        {
            BigInteger r = FromBigEndian(sigP1363, 0, 32);
            BigInteger s = FromBigEndian(sigP1363, 32, 32);
            if (r.Sign <= 0 || r >= N || s.Sign <= 0 || s >= N) return false;

            BigInteger x = FromBigEndian(qx, 0, 32);
            BigInteger y = FromBigEndian(qy, 0, 32);
            if (x >= P || y >= P || !IsOnCurve(x, y)) return false;

            BigInteger e = FromBigEndian(digest, 0, digest.Length); // SHA-256 is exactly 256 bits: no truncation
            BigInteger w = BigInteger.ModPow(s, N - 2, N);
            BigInteger u1 = e * w % N;
            BigInteger u2 = r * w % N;

            Jac sum = Add(Mul(new Jac(Gx, Gy, BigInteger.One), u1), Mul(new Jac(x, y, BigInteger.One), u2));
            if (sum.IsInfinity) return false;

            BigInteger zInv = BigInteger.ModPow(sum.Z, P - 2, P);
            BigInteger affineX = Mod(sum.X * zInv * zInv);
            return affineX % N == r;
        }

        private static bool IsOnCurve(BigInteger x, BigInteger y)
        {
            // y^2 = x^3 - 3x + b (mod p)
            return Mod(y * y) == Mod(x * x * x - 3 * x + B);
        }

        private static Jac Mul(Jac point, BigInteger k)
        {
            var acc = new Jac(BigInteger.Zero, BigInteger.One, BigInteger.Zero);
            for (int bit = 255; bit >= 0; bit--)
            {
                acc = Double(acc);
                if (!((k >> bit) & BigInteger.One).IsZero)
                {
                    acc = Add(acc, point);
                }
            }
            return acc;
        }

        private static Jac Double(Jac p)
        {
            if (p.IsInfinity || p.Y.IsZero) return new Jac(BigInteger.Zero, BigInteger.One, BigInteger.Zero);
            BigInteger delta = Mod(p.Z * p.Z);
            BigInteger gamma = Mod(p.Y * p.Y);
            BigInteger beta = Mod(p.X * gamma);
            BigInteger alpha = Mod(3 * (p.X - delta) * (p.X + delta));
            BigInteger x3 = Mod(alpha * alpha - 8 * beta);
            BigInteger z3 = Mod((p.Y + p.Z) * (p.Y + p.Z) - gamma - delta);
            BigInteger y3 = Mod(alpha * (4 * beta - x3) - 8 * gamma * gamma);
            return new Jac(x3, y3, z3);
        }

        private static Jac Add(Jac p, Jac q)
        {
            if (p.IsInfinity) return q;
            if (q.IsInfinity) return p;
            BigInteger z1z1 = Mod(p.Z * p.Z);
            BigInteger z2z2 = Mod(q.Z * q.Z);
            BigInteger u1 = Mod(p.X * z2z2);
            BigInteger u2 = Mod(q.X * z1z1);
            BigInteger s1 = Mod(p.Y * q.Z * z2z2);
            BigInteger s2 = Mod(q.Y * p.Z * z1z1);
            if (u1 == u2)
            {
                return s1 == s2 ? Double(p) : new Jac(BigInteger.Zero, BigInteger.One, BigInteger.Zero);
            }
            BigInteger h = Mod(u2 - u1);
            BigInteger rr = Mod(s2 - s1);
            BigInteger h2 = Mod(h * h);
            BigInteger h3 = Mod(h * h2);
            BigInteger u1h2 = Mod(u1 * h2);
            BigInteger x3 = Mod(rr * rr - h3 - 2 * u1h2);
            BigInteger y3 = Mod(rr * (u1h2 - x3) - s1 * h3);
            BigInteger z3 = Mod(h * p.Z * q.Z);
            return new Jac(x3, y3, z3);
        }

        private static BigInteger Mod(BigInteger v)
        {
            BigInteger m = v % P;
            return m.Sign < 0 ? m + P : m;
        }

        private static BigInteger Hex(string hex)
        {
            return BigInteger.Parse("0" + hex, System.Globalization.NumberStyles.HexNumber);
        }

        private static BigInteger FromBigEndian(byte[] data, int offset, int length)
        {
            var little = new byte[length + 1]; // trailing zero byte keeps the value unsigned
            for (int i = 0; i < length; i++)
            {
                little[i] = data[offset + length - 1 - i];
            }
            return new BigInteger(little);
        }
    }
}
