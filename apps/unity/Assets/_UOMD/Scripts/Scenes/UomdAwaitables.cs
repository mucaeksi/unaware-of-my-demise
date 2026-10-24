using UnityEngine;

namespace Uomd.Scenes
{
    public static class UomdAwaitables
    {
        /// <summary>
        /// An already finished Awaitable for synchronous IUomdScreenController.OnEnterAsync bodies.
        /// Awaitable is a class, so `return default;` hands the router a null and `await` throws NullReferenceException.
        /// Each call returns a fresh instance because a pooled Awaitable may be awaited only once.
        /// </summary>
        public static Awaitable Completed()
        {
            var source = new AwaitableCompletionSource();
            source.SetResult();
            return source.Awaitable;
        }
    }
}
