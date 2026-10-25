#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;

namespace Uomd.Core
{
    /// <summary>Null-safe readers over the UomdJson object graph (dictionaries, lists, long/double, string, bool).</summary>
    public static class JsonRead
    {
        public static object? Get(object? node, string key) =>
            node is Dictionary<string, object?> o && o.TryGetValue(key, out object? v) ? v : null;

        public static string Str(object? node, string key, string fallback = "") => Get(node, key) switch
        {
            string s => s,
            long l => l.ToString(CultureInfo.InvariantCulture),
            double d => d.ToString(CultureInfo.InvariantCulture),
            bool b => b ? "true" : "false",
            _ => fallback
        };

        public static double Num(object? node, string key, double fallback = 0) => Get(node, key) switch
        {
            long l => l,
            double d => d,
            _ => fallback
        };

        public static long Int(object? node, string key, long fallback = 0) => Get(node, key) switch
        {
            long l => l,
            double d => (long)d,
            _ => fallback
        };

        public static bool Bool(object? node, string key, bool fallback = false) => Get(node, key) is bool b ? b : fallback;

        public static Dictionary<string, object?> Obj(object? node, string key) =>
            Get(node, key) as Dictionary<string, object?> ?? new Dictionary<string, object?>(StringComparer.Ordinal);

        public static List<object?> Arr(object? node, string key) => Get(node, key) as List<object?> ?? new List<object?>();

        /// <summary>The objects of an array, skipping anything that is not an object.</summary>
        public static IEnumerable<Dictionary<string, object?>> Objects(object? node, string key)
        {
            foreach (var item in Arr(node, key)) if (item is Dictionary<string, object?> o) yield return o;
        }

        public static IEnumerable<string> Strings(object? node, string key)
        {
            foreach (var item in Arr(node, key)) if (item is string s) yield return s;
        }
    }
}
