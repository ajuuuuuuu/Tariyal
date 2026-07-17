import sys

content = open('src/routes/index.tsx').read()

# 1. Add spouses and children to the traversal logic in treeViewPersons
old_traversal_end = '      siblingIds.forEach((siblingId) => {\n        relationships\n          .filter((r) => r.type === "parent" && r.person1Id === siblingId)\n          .forEach((r) => ids.add(r.person2Id));\n      });'
new_traversal_add = '''
      // Add spouses of the focal person
      relationships
        .filter((r) => r.type === "spouse" && (r.person1Id === treeViewPerson.id || r.person2Id === treeViewPerson.id))
        .forEach((r) => ids.add(r.person1Id === treeViewPerson.id ? r.person2Id : r.person1Id));

      // Add children of the focal person
      relationships
        .filter((r) => r.type === "parent" && r.person1Id === treeViewPerson.id)
        .forEach((r) => ids.add(r.person2Id));'''

if old_traversal_end in content:
    content = content.replace(old_traversal_end, old_traversal_end + new_traversal_add)

# 2. Ensure the filtering logic is clean (I already did a sed, but let's make it more official)
# The previous sed changed it to: Boolean(p) && (true /* Allow all related people regardless of familyGroup in personal views */)
# Let's just make it: Boolean(p)

content = content.replace('Boolean(p) && (true /* Allow all related people regardless of familyGroup in personal views */)', 'Boolean(p)')

with open('src/routes/index.tsx', 'w') as f:
    f.write(content)
