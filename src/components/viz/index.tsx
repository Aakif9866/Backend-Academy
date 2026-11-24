import type { ComponentType } from "react";
import RequestLifecycle from "./RequestLifecycle";
import LoadBalancer from "./LoadBalancer";
import CacheEviction from "./CacheEviction";
import RateLimiter from "./RateLimiter";
import CircuitBreaker from "./CircuitBreaker";
import ConsistentHashing from "./ConsistentHashing";
import KafkaPartitions from "./KafkaPartitions";
import Quorum from "./Quorum";
import LostUpdate from "./LostUpdate";

// Name used in Markdown: <div data-viz="load-balancer"></div>
export const vizRegistry: Record<string, ComponentType> = {
  "request-lifecycle": RequestLifecycle,
  "load-balancer": LoadBalancer,
  "cache-eviction": CacheEviction,
  "rate-limiter": RateLimiter,
  "circuit-breaker": CircuitBreaker,
  "consistent-hashing": ConsistentHashing,
  "kafka-partitions": KafkaPartitions,
  quorum: Quorum,
  "lost-update": LostUpdate,
};
