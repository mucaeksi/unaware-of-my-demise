#nullable enable
using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;

namespace Uomd.Core
{
    /// <summary>
    /// Bit-exact C# port of packages/shared/src/signing.ts.
    /// Verifies ECDSA P-256 / SHA-256 (ES256, IEEE P1363 64-byte R||S encoding) signatures over
    /// CanonicalJson(payload without "signature") against UomdClientConfig.TrustedPublicKeys.
    /// </summary>
    public static class Es256SignatureVerifier
    {
        public static bool VerifySignedPayload(
            IDictionary<string, object?> payload,
            string signatureKid,
            string signatureAlg,
            string signatureBase64Url,
            IReadOnlyList<TrustKeyJwk>? trustedKeys = null)
        {
            if (string.IsNullOrEmpty(signatureKid) ||
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

            if (jwk.Kty != "EC" || jwk.Crv != "P-256" || jwk.X.Length != 43 || jwk.Y.Length != 43)
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

                var ecParams = new ECParameters
                {
                    Curve = ECCurve.NamedCurves.nistP256,
                    Q = new ECPoint { X = xBytes, Y = yBytes }
                };

                using var ecdsa = ECDsa.Create(ecParams);
                return ecdsa.VerifyData(signingInput, sigBytes, HashAlgorithmName.SHA256);
            }
            catch
            {
                return false;
            }
        }
    }
}
