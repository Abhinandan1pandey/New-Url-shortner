import hashlib
from typing import Any, Dict, List, Optional, Tuple

class HashTableNode:
    """
    Represents a node in the linked list chain for Separate Chaining.
    """
    def __init__(self, key: str, value: Any):
        self.key: str = key
        self.value: Any = value
        self.next: Optional['HashTableNode'] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "key": self.key,
            "value": self.value
        }


class HashTable:
    """
    Custom Hash Table mimicking C++ std::unordered_map behaviors:
    - Bucket array of linked lists (Separate Chaining).
    - Threshold-based dynamic rehashing (load factor > 1.0).
    - Traversal metrics for visual simulations.
    """
    def __init__(self, capacity: int = 16, max_load_factor: float = 1.0):
        self.capacity: int = capacity
        self.max_load_factor: float = max_load_factor
        self.size: int = 0
        self.buckets: List[Optional[HashTableNode]] = [None] * self.capacity
        self.rehash_count: int = 0

    def _hash(self, key: str) -> int:
        """
        Compute hash bucket index using SHA-256, similar to std::hash conversions.
        """
        sha256_hash = hashlib.sha256(key.encode('utf-8')).hexdigest()
        hash_int = int(sha256_hash, 16)
        return hash_int % self.capacity

    def insert(self, key: str, value: Any) -> Dict[str, Any]:
        """
        Insert key-value pair. If key exists, update value.
        If load factor exceeds max_load_factor (1.0), triggers rehashing (capacity doubles).
        Returns a dictionary detailing step-by-step actions for visualization.
        """
        steps: Dict[str, Any] = {
            "key": key,
            "hash_value": hashlib.sha256(key.encode('utf-8')).hexdigest(),
            "capacity_before": self.capacity,
            "load_factor_before": round(self.size / self.capacity, 3),
            "rehashed": False,
            "collision_detected": False,
            "chain_traversal": [],
            "operation": "insert",
            "bucket_index": None
        }

        bucket_idx = self._hash(key)
        steps["bucket_index"] = bucket_idx

        # Check the bucket linked list
        curr = self.buckets[bucket_idx]
        prev = None
        chain_len = 0
        
        # Traverse list to find if key already exists or to reach the tail
        while curr is not None:
            chain_len += 1
            steps["chain_traversal"].append(curr.key)
            if curr.key == key:
                # Update existing key
                curr.value = value
                steps["operation"] = "update"
                steps["load_factor_after"] = round(self.size / self.capacity, 3)
                return steps
            prev = curr
            curr = curr.next

        # Key does not exist, insert new node
        new_node = HashTableNode(key, value)
        if prev is None:
            # Bucket was empty
            self.buckets[bucket_idx] = new_node
        else:
            # Collision! Append to tail
            prev.next = new_node
            steps["collision_detected"] = True
            steps["chain_length_before"] = chain_len

        self.size += 1
        current_load_factor = self.size / self.capacity
        steps["load_factor_after"] = round(current_load_factor, 3)

        # Trigger rehash if load factor exceeds threshold
        if current_load_factor > self.max_load_factor:
            rehash_details = self.rehash()
            steps["rehashed"] = True
            steps["rehash_details"] = rehash_details
            steps["capacity_after"] = self.capacity
            steps["load_factor_after"] = round(self.size / self.capacity, 3)

        return steps

    def search(self, key: str) -> Tuple[Optional[Any], Dict[str, Any]]:
        """
        Search for key in hash table.
        Returns a tuple of (value, traversal_steps) for visual feedback.
        """
        bucket_idx = self._hash(key)
        steps = {
            "key": key,
            "bucket_index": bucket_idx,
            "chain_traversal": [],
            "found": False,
            "comparisons": 0
        }

        curr = self.buckets[bucket_idx]
        while curr is not None:
            steps["comparisons"] += 1
            steps["chain_traversal"].append(curr.key)
            if curr.key == key:
                steps["found"] = True
                return curr.value, steps
            curr = curr.next

        return None, steps

    def delete(self, key: str) -> Tuple[bool, Dict[str, Any]]:
        """
        Delete key from hash table.
        Returns a tuple of (success_status, deletion_steps).
        """
        bucket_idx = self._hash(key)
        steps = {
            "key": key,
            "bucket_index": bucket_idx,
            "chain_traversal": [],
            "deleted": False
        }

        curr = self.buckets[bucket_idx]
        prev = None

        while curr is not None:
            steps["chain_traversal"].append(curr.key)
            if curr.key == key:
                if prev is None:
                    # Head of chain
                    self.buckets[bucket_idx] = curr.next
                else:
                    prev.next = curr.next
                self.size -= 1
                steps["deleted"] = True
                return True, steps
            prev = curr
            curr = curr.next

        return False, steps

    def rehash(self) -> Dict[str, Any]:
        """
        Double the capacity of the bucket array and rehash all nodes.
        Returns details about the redistribution of nodes.
        """
        old_capacity = self.capacity
        old_buckets = self.buckets
        
        # Double the capacity (C++ std::unordered_map default resizing)
        self.capacity *= 2
        self.buckets = [None] * self.capacity
        self.size = 0  # Re-insertions will increment size back

        rehash_mapping: List[Dict[str, Any]] = []

        for b_idx in range(old_capacity):
            curr = old_buckets[b_idx]
            while curr is not None:
                # Store node data before rehashing
                key = curr.key
                val = curr.value
                new_idx = self._hash(key)
                
                # Insert to new bucket array
                self.insert_without_rehash(key, val)
                
                rehash_mapping.append({
                    "key": key,
                    "old_bucket": b_idx,
                    "new_bucket": new_idx
                })
                curr = curr.next

        self.rehash_count += 1
        return {
            "old_capacity": old_capacity,
            "new_capacity": self.capacity,
            "redistributions": rehash_mapping
        }

    def insert_without_rehash(self, key: str, value: Any) -> None:
        """
        Internal insertion helper to avoid recursive triggers during rehashing.
        """
        bucket_idx = self._hash(key)
        curr = self.buckets[bucket_idx]
        prev = None
        
        while curr is not None:
            if curr.key == key:
                curr.value = value
                return
            prev = curr
            curr = curr.next

        new_node = HashTableNode(key, value)
        if prev is None:
            self.buckets[bucket_idx] = new_node
        else:
            prev.next = new_node
        self.size += 1

    def get_stats(self) -> Dict[str, Any]:
        """
        Compute hash table statistics.
        """
        filled_buckets = 0
        collision_count = 0
        max_chain_len = 0
        chain_lengths = []

        for b_idx in range(self.capacity):
            curr = self.buckets[b_idx]
            chain_len = 0
            while curr is not None:
                chain_len += 1
                curr = curr.next
            
            chain_lengths.append(chain_len)
            if chain_len > 0:
                filled_buckets += 1
                if chain_len > 1:
                    collision_count += (chain_len - 1)
                if chain_len > max_chain_len:
                    max_chain_len = chain_len

        avg_chain_len = sum(chain_lengths) / filled_buckets if filled_buckets > 0 else 0.0
        load_factor = self.size / self.capacity if self.capacity > 0 else 0.0

        # Construct visual state of buckets for frontend representation
        buckets_visual = []
        for b_idx in range(self.capacity):
            chain = []
            curr = self.buckets[b_idx]
            while curr is not None:
                chain.append(curr.key)
                curr = curr.next
            buckets_visual.append({
                "index": b_idx,
                "chain": chain
            })

        return {
            "capacity": self.capacity,
            "size": self.size,
            "load_factor": round(load_factor, 3),
            "max_load_factor": self.max_load_factor,
            "filled_buckets": filled_buckets,
            "collision_count": collision_count,
            "max_chain_length": max_chain_len,
            "average_chain_length": round(avg_chain_len, 3),
            "rehash_count": self.rehash_count,
            "buckets": buckets_visual
        }
