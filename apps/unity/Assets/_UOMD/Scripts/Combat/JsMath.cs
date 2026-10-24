#nullable enable
// JavaScript semantics the combat port depends on for bit-exact replay.
using System;
using System.Collections.Generic;

namespace Uomd.Combat
{
    public static class JsMath
    {
        /// <summary>The engine's half-up rounding with its epsilon: Math.floor(x + 0.5 + 1e-9).</summary>
        public static double RoundHalfUp(double x) => Math.Floor(x + 0.5 + 1e-9);

        /// <summary>JavaScript Math.round: nearest integer, ties toward +Infinity (x - floor(x) is exact for doubles).</summary>
        public static double Round(double x)
        {
            double f = Math.Floor(x);
            return x - f >= 0.5 ? f + 1 : f;
        }

        /// <summary>JavaScript `a &lt; b` on strings: UTF-16 code unit order.</summary>
        public static bool Less(string a, string b) => string.CompareOrdinal(a, b) < 0;

        /// <summary>A comparator term the way `x || y` chains it: 0 and NaN fall through to the next term.</summary>
        public static bool Decides(double c) => c != 0 && !double.IsNaN(c);

        /// <summary>
        /// Array.prototype.sort: stable, and an element moves before another only when the comparator says &lt; 0
        /// (as V8's TimSort). Returns a sorted copy.
        /// </summary>
        public static List<T> Sorted<T>(IEnumerable<T> items, Func<T, T, double> cmp)
        {
            var a = new List<T>(items);
            if (a.Count < 2) return a;
            var buf = new T[a.Count];
            MergeSort(a, buf, 0, a.Count, cmp);
            return a;
        }

        private static void MergeSort<T>(List<T> a, T[] buf, int lo, int hi, Func<T, T, double> cmp)
        {
            if (hi - lo < 2) return;
            int mid = (lo + hi) / 2;
            MergeSort(a, buf, lo, mid, cmp);
            MergeSort(a, buf, mid, hi, cmp);
            int i = lo, j = mid, k = lo;
            while (i < mid && j < hi) buf[k++] = cmp(a[j], a[i]) < 0 ? a[j++] : a[i++];
            while (i < mid) buf[k++] = a[i++];
            while (j < hi) buf[k++] = a[j++];
            for (k = lo; k < hi; k++) a[k] = buf[k];
        }
    }
}
