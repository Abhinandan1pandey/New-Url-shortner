import pytest
from hash_table import HashTable

def test_hash_table_basic_operations():
    """
    Test basic insert, search, and delete functions.
    """
    ht = HashTable(capacity=8)
    
    # Insert keys
    ht.insert("apple", "red")
    ht.insert("banana", "yellow")
    
    assert ht.size == 2
    
    # Search keys
    val_apple, steps_apple = ht.search("apple")
    assert val_apple == "red"
    assert steps_apple["found"] is True
    
    val_banana, steps_banana = ht.search("banana")
    assert val_banana == "yellow"
    assert steps_banana["found"] is True
    
    # Search non-existing key
    val_cherry, steps_cherry = ht.search("cherry")
    assert val_cherry is None
    assert steps_cherry["found"] is False
    
    # Update key
    ht.insert("apple", "green")
    val_apple_updated, _ = ht.search("apple")
    assert val_apple_updated == "green"
    assert ht.size == 2  # Size shouldn't change on updates
    
    # Delete key
    deleted, steps_del = ht.delete("apple")
    assert deleted is True
    assert steps_del["deleted"] is True
    assert ht.size == 1
    
    # Verify deletion
    val_deleted, _ = ht.search("apple")
    assert val_deleted is None

def test_hash_table_collisions():
    """
    Test collision resolution using Separate Chaining.
    Force multiple keys to map to the same bucket by setting a small capacity and not rehashing.
    """
    # Max load factor 10.0 to prevent rehashing during the test
    ht = HashTable(capacity=4, max_load_factor=10.0)
    
    # We insert 5 keys. With capacity 4, at least one bucket must have a collision (Pigeonhole Principle).
    keys = ["k1", "k2", "k3", "k4", "k5"]
    for i, k in enumerate(keys):
        ht.insert(k, f"val_{i}")
        
    stats = ht.get_stats()
    assert stats["size"] == 5
    assert stats["collision_count"] > 0
    assert stats["max_chain_length"] > 1
    
    # Verify we can find all elements despite collisions
    for i, k in enumerate(keys):
        val, steps = ht.search(k)
        assert val == f"val_{i}"
        assert steps["found"] is True
        
    # Delete a key in a chain and verify other keys in that chain are still searchable
    # Find a bucket with a chain length > 1
    target_bucket = None
    for bucket in stats["buckets"]:
        if len(bucket["chain"]) > 1:
            target_bucket = bucket
            break
            
    assert target_bucket is not None
    chain_keys = target_bucket["chain"]
    key_to_delete = chain_keys[0]
    key_to_keep = chain_keys[1]
    
    # Delete first key
    deleted, _ = ht.delete(key_to_delete)
    assert deleted is True
    
    # Deleted key should be gone
    val_del, _ = ht.search(key_to_delete)
    assert val_del is None
    
    # Kept key should still exist
    val_keep, _ = ht.search(key_to_keep)
    assert val_keep is not None

def test_hash_table_dynamic_rehashing():
    """
    Test C++ std::unordered_map style rehashing.
    When load factor > 1.0, the capacity should double, and elements should be redistributed.
    """
    # Start with capacity 4, threshold load factor 1.0 (rehashes when size > 4)
    ht = HashTable(capacity=4, max_load_factor=1.0)
    
    # Insert 4 keys
    ht.insert("a", "1")
    ht.insert("b", "2")
    ht.insert("c", "3")
    ht.insert("d", "4")
    
    stats_before = ht.get_stats()
    assert stats_before["capacity"] == 4
    assert stats_before["size"] == 4
    assert stats_before["load_factor"] == 1.0
    assert stats_before["rehash_count"] == 0
    
    # Insert 5th key to trigger rehash (load factor becomes 5/4 = 1.25 > 1.0)
    insert_steps = ht.insert("e", "5")
    
    assert insert_steps["rehashed"] is True
    
    stats_after = ht.get_stats()
    assert stats_after["capacity"] == 8  # Capacity doubled
    assert stats_after["size"] == 5
    assert stats_after["load_factor"] == 0.625  # 5/8 = 0.625 (re-adjusted)
    assert stats_after["rehash_count"] == 1
    
    # All 5 elements must be searchable and have correct values
    for k, v in [("a", "1"), ("b", "2"), ("c", "3"), ("d", "4"), ("e", "5")]:
        val, _ = ht.search(k)
        assert val == v
