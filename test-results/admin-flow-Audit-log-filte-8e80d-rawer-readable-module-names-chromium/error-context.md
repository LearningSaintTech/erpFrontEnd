# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-flow.spec.ts >> Audit log: filters, detail drawer, readable module names
- Location: e2e\admin-flow.spec.ts:582:1

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 1
Received:   0
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - link "Skip to content" [ref=e5] [cursor=pointer]:
      - /url: "#erp-main"
    - complementary "Sidebar" [ref=e6]:
      - link "ERP Factory — dashboard" [ref=e8] [cursor=pointer]:
        - /url: /
        - generic [ref=e9]: EF
        - generic [ref=e10]:
          - generic [ref=e11]: ERP Factory
          - generic [ref=e12]: Factory workspace
      - navigation "Main" [ref=e13]:
        - list [ref=e15]:
          - listitem [ref=e16]:
            - link "Dashboard" [ref=e17] [cursor=pointer]:
              - /url: /
              - img [ref=e18]
              - generic [ref=e23]: Dashboard
          - listitem [ref=e24]:
            - link "Approvals" [ref=e25] [cursor=pointer]:
              - /url: /approvals
              - img [ref=e26]
              - generic [ref=e29]: Approvals
        - generic [ref=e30]:
          - paragraph [ref=e31]: Develop
          - list [ref=e32]:
            - listitem [ref=e33]:
              - link "Designs" [ref=e34] [cursor=pointer]:
                - /url: /designs
                - img [ref=e35]
                - generic [ref=e41]: Designs
            - listitem [ref=e42]:
              - link "Patterns" [ref=e43] [cursor=pointer]:
                - /url: /pattern
                - img [ref=e44]
                - generic [ref=e50]: Patterns
            - listitem [ref=e51]:
              - link "Samples" [ref=e52] [cursor=pointer]:
                - /url: /samples
                - img [ref=e53]
                - generic [ref=e55]: Samples
        - generic [ref=e56]:
          - paragraph [ref=e57]: Products
          - list [ref=e58]:
            - listitem [ref=e59]:
              - link "SKUs" [ref=e60] [cursor=pointer]:
                - /url: /products/skus
                - img [ref=e61]
                - generic [ref=e64]: SKUs
            - listitem [ref=e65]:
              - link "BOMs" [ref=e66] [cursor=pointer]:
                - /url: /products/boms
                - img [ref=e67]
                - generic [ref=e71]: BOMs
        - generic [ref=e72]:
          - paragraph [ref=e73]: Procure
          - list [ref=e74]:
            - listitem [ref=e75]:
              - link "Purchase" [ref=e76] [cursor=pointer]:
                - /url: /purchase
                - img [ref=e77]
                - generic [ref=e81]: Purchase
            - listitem [ref=e82]:
              - link "Vendors" [ref=e83] [cursor=pointer]:
                - /url: /vendors
                - img [ref=e84]
                - generic [ref=e88]: Vendors
        - generic [ref=e89]:
          - paragraph [ref=e90]: Stock
          - list [ref=e91]:
            - listitem [ref=e92]:
              - link "Inventory" [ref=e93] [cursor=pointer]:
                - /url: /inventory
                - img [ref=e94]
                - generic [ref=e104]: Inventory
            - listitem [ref=e105]:
              - button "Warehouse" [ref=e107] [cursor=pointer]:
                - img [ref=e108]
                - generic [ref=e111]: Warehouse
                - img [ref=e112]
        - generic [ref=e114]:
          - paragraph [ref=e115]: Make
          - list [ref=e116]:
            - listitem [ref=e117]:
              - link "Production orders" [ref=e118] [cursor=pointer]:
                - /url: /production/orders
                - img [ref=e119]
                - generic [ref=e121]: Production orders
            - listitem [ref=e122]:
              - link "Machines & capacity" [ref=e123] [cursor=pointer]:
                - /url: /production/machines
                - img [ref=e124]
                - generic [ref=e135]: Machines & capacity
            - listitem [ref=e136]:
              - link "Waste" [ref=e137] [cursor=pointer]:
                - /url: /waste
                - img [ref=e138]
                - generic [ref=e145]: Waste
        - generic [ref=e146]:
          - paragraph [ref=e147]: Quality
          - list [ref=e148]:
            - listitem [ref=e149]:
              - link "Inspections" [ref=e150] [cursor=pointer]:
                - /url: /quality/inspections
                - img [ref=e151]
                - generic [ref=e155]: Inspections
            - listitem [ref=e156]:
              - link "CAPA" [ref=e157] [cursor=pointer]:
                - /url: /quality/capa
                - img [ref=e158]
                - generic [ref=e161]: CAPA
            - listitem [ref=e162]:
              - link "Templates" [ref=e163] [cursor=pointer]:
                - /url: /quality/templates
                - img [ref=e164]
                - generic [ref=e167]: Templates
        - generic [ref=e168]:
          - paragraph [ref=e169]: Insights
          - list [ref=e170]:
            - listitem [ref=e171]:
              - link "Reports" [ref=e172] [cursor=pointer]:
                - /url: /reports/factory
                - img [ref=e173]
                - generic [ref=e175]: Reports
            - listitem [ref=e176]:
              - link "Notifications" [ref=e177] [cursor=pointer]:
                - /url: /notifications
                - img [ref=e178]
                - generic [ref=e181]: Notifications
            - listitem [ref=e182]:
              - link "Messages" [ref=e183] [cursor=pointer]:
                - /url: /chat
                - img [ref=e184]
                - generic [ref=e186]: Messages
        - generic [ref=e187]:
          - paragraph [ref=e188]: Administration
          - list [ref=e189]:
            - listitem [ref=e190]:
              - link "Users & roles" [ref=e191] [cursor=pointer]:
                - /url: /users
                - img [ref=e192]
                - generic [ref=e197]: Users & roles
            - listitem [ref=e198]:
              - link "Approval workflows" [ref=e199] [cursor=pointer]:
                - /url: /approvals?tab=workflows
                - img [ref=e200]
                - generic [ref=e204]: Approval workflows
            - listitem [ref=e205]:
              - link "Settings" [ref=e206] [cursor=pointer]:
                - /url: /settings
                - img [ref=e207]
                - generic [ref=e210]: Settings
            - listitem [ref=e211]:
              - link "Factory settings" [ref=e212] [cursor=pointer]:
                - /url: /settings/factory-settings
                - img [ref=e213]
                - generic [ref=e216]: Factory settings
            - listitem [ref=e217]:
              - link "Inventory codes" [ref=e218] [cursor=pointer]:
                - /url: /settings/inventory-codes
                - img [ref=e219]
                - generic [ref=e220]: Inventory codes
            - listitem [ref=e221]:
              - link "Audit logs" [ref=e222] [cursor=pointer]:
                - /url: /audit
                - img [ref=e223]
                - generic [ref=e227]: Audit logs
      - button "Collapse sidebar" [ref=e230] [cursor=pointer]:
        - img [ref=e231]
        - generic [ref=e234]: Collapse
    - generic [ref=e235]:
      - banner [ref=e236]:
        - navigation "Breadcrumb" [ref=e238]:
          - list [ref=e239]:
            - listitem [ref=e240]: Administration
            - listitem [ref=e241]:
              - img [ref=e242]
            - listitem [ref=e244]: Audit logs
        - button "Search pages and actions" [ref=e245] [cursor=pointer]:
          - img [ref=e246]
          - generic [ref=e249]: Search…
          - generic [ref=e250]: Ctrl K
        - generic "F01 — Main Production Unit" [ref=e251]: Main Production Unit
        - generic [ref=e252]:
          - button "Messages" [ref=e253] [cursor=pointer]:
            - img [ref=e254]
          - button "Notifications, 18 unread" [ref=e257] [cursor=pointer]:
            - img [ref=e258]
            - generic [ref=e261]: 9+
        - button "Account menu for Factory Admin" [ref=e263] [cursor=pointer]:
          - generic [ref=e264]: FA
          - img [ref=e265]
      - main [ref=e267]:
        - generic [ref=e268]:
          - generic [ref=e270]:
            - generic [ref=e271]:
              - heading "Audit log" [level=1] [ref=e273]
              - paragraph [ref=e274]: "Every change made in the system: who did what, and when."
            - button "Export CSV" [ref=e276] [cursor=pointer]:
              - img [ref=e277]
              - text: Export CSV
          - generic [ref=e281]:
            - toolbar "Filters" [ref=e282]:
              - generic [ref=e284]:
                - img
                - searchbox "Filter by user email" [ref=e285]
              - generic [ref=e286]:
                - combobox "Module" [ref=e287] [cursor=pointer]:
                  - option "All modules" [selected]
                  - option "Approval"
                  - option "Design"
                  - option "Inventory"
                  - option "Organization"
                  - option "Access control"
                  - option "Settings"
                  - option "User"
                - combobox "Action" [ref=e288] [cursor=pointer]:
                  - option "All actions" [selected]
                  - option "Created or actioned"
                  - option "Edited"
                  - option "Saved settings / replaced"
                  - option "Deleted"
                - combobox "Date range" [ref=e289] [cursor=pointer]:
                  - option "All time" [selected]
                  - option "Today"
                  - option "Last 7 days"
                  - option "Last 30 days"
                  - option "Custom range"
            - table [ref=e290]:
              - rowgroup [ref=e291]:
                - row "When User Action Module Endpoint" [ref=e292]:
                  - columnheader "When" [ref=e293]
                  - columnheader "User" [ref=e294]
                  - columnheader "Action" [ref=e295]
                  - columnheader "Module" [ref=e296]
                  - columnheader "Endpoint" [ref=e297]
              - rowgroup [ref=e298]:
                - row "1m ago 10/11/2026, 7:14:45 PM pw-mv3vj9qe@demo.local POST Changed password for user me User /api/v1/users/me/change-password" [ref=e299] [cursor=pointer]:
                  - cell "1m ago 10/11/2026, 7:14:45 PM" [ref=e300]:
                    - generic [ref=e301]: 1m ago
                    - generic [ref=e302]: 10/11/2026, 7:14:45 PM
                  - cell "pw-mv3vj9qe@demo.local" [ref=e303]
                  - cell "POST Changed password for user me" [ref=e304]:
                    - generic [ref=e305]:
                      - generic [ref=e307]: POST
                      - generic [ref=e308]: Changed password for user me
                  - cell "User" [ref=e309]
                  - cell "/api/v1/users/me/change-password" [ref=e310]
                - row "1m ago 10/11/2026, 7:13:53 PM admin@demo.local POST Created user roles User /api/v1/users/6acb9298f0d9467ae068a848/roles" [ref=e311] [cursor=pointer]:
                  - cell "1m ago 10/11/2026, 7:13:53 PM" [ref=e312]:
                    - generic [ref=e313]: 1m ago
                    - generic [ref=e314]: 10/11/2026, 7:13:53 PM
                  - cell "admin@demo.local" [ref=e315]
                  - cell "POST Created user roles" [ref=e316]:
                    - generic [ref=e317]:
                      - generic [ref=e319]: POST
                      - generic [ref=e320]: Created user roles
                  - cell "User" [ref=e321]
                  - cell "/api/v1/users/6acb9298f0d9467ae068a848/roles" [ref=e322]
                - row "1m ago 10/11/2026, 7:13:53 PM admin@demo.local role.assign role.assign Access control —" [ref=e323] [cursor=pointer]:
                  - cell "1m ago 10/11/2026, 7:13:53 PM" [ref=e324]:
                    - generic [ref=e325]: 1m ago
                    - generic [ref=e326]: 10/11/2026, 7:13:53 PM
                  - cell "admin@demo.local" [ref=e327]
                  - cell "role.assign role.assign" [ref=e328]:
                    - generic [ref=e329]:
                      - generic [ref=e331]: role.assign
                      - generic [ref=e332]: role.assign
                  - cell "Access control" [ref=e333]
                  - cell "—" [ref=e334]
                - row "1m ago 10/11/2026, 7:13:52 PM admin@demo.local POST Created user User /api/v1/users" [ref=e335] [cursor=pointer]:
                  - cell "1m ago 10/11/2026, 7:13:52 PM" [ref=e336]:
                    - generic [ref=e337]: 1m ago
                    - generic [ref=e338]: 10/11/2026, 7:13:52 PM
                  - cell "admin@demo.local" [ref=e339]
                  - cell "POST Created user" [ref=e340]:
                    - generic [ref=e341]:
                      - generic [ref=e343]: POST
                      - generic [ref=e344]: Created user
                  - cell "User" [ref=e345]
                  - cell "/api/v1/users" [ref=e346]
                - row "1m ago 10/11/2026, 7:13:52 PM admin@demo.local user.create user.create Access control —" [ref=e347] [cursor=pointer]:
                  - cell "1m ago 10/11/2026, 7:13:52 PM" [ref=e348]:
                    - generic [ref=e349]: 1m ago
                    - generic [ref=e350]: 10/11/2026, 7:13:52 PM
                  - cell "admin@demo.local" [ref=e351]
                  - cell "user.create user.create" [ref=e352]:
                    - generic [ref=e353]:
                      - generic [ref=e355]: user.create
                      - generic [ref=e356]: user.create
                  - cell "Access control" [ref=e357]
                  - cell "—" [ref=e358]
                - row "2m ago 10/11/2026, 7:13:10 PM admin@demo.local DELETE Deleted inventory code Inventory /api/v1/inventory-codes/6acb9264f0d9467ae068a7ed" [ref=e359] [cursor=pointer]:
                  - cell "2m ago 10/11/2026, 7:13:10 PM" [ref=e360]:
                    - generic [ref=e361]: 2m ago
                    - generic [ref=e362]: 10/11/2026, 7:13:10 PM
                  - cell "admin@demo.local" [ref=e363]
                  - cell "DELETE Deleted inventory code" [ref=e364]:
                    - generic [ref=e365]:
                      - generic [ref=e367]: DELETE
                      - generic [ref=e368]: Deleted inventory code
                  - cell "Inventory" [ref=e369]
                  - cell "/api/v1/inventory-codes/6acb9264f0d9467ae068a7ed" [ref=e370]
                - row "2m ago 10/11/2026, 7:13:04 PM admin@demo.local PATCH Updated inventory code Inventory /api/v1/inventory-codes/6acb9264f0d9467ae068a7ed" [ref=e371] [cursor=pointer]:
                  - cell "2m ago 10/11/2026, 7:13:04 PM" [ref=e372]:
                    - generic [ref=e373]: 2m ago
                    - generic [ref=e374]: 10/11/2026, 7:13:04 PM
                  - cell "admin@demo.local" [ref=e375]
                  - cell "PATCH Updated inventory code" [ref=e376]:
                    - generic [ref=e377]:
                      - generic [ref=e379]: PATCH
                      - generic [ref=e380]: Updated inventory code
                  - cell "Inventory" [ref=e381]
                  - cell "/api/v1/inventory-codes/6acb9264f0d9467ae068a7ed" [ref=e382]
                - row "2m ago 10/11/2026, 7:13:00 PM admin@demo.local POST Created inventory code Inventory /api/v1/inventory-codes" [ref=e383] [cursor=pointer]:
                  - cell "2m ago 10/11/2026, 7:13:00 PM" [ref=e384]:
                    - generic [ref=e385]: 2m ago
                    - generic [ref=e386]: 10/11/2026, 7:13:00 PM
                  - cell "admin@demo.local" [ref=e387]
                  - cell "POST Created inventory code" [ref=e388]:
                    - generic [ref=e389]:
                      - generic [ref=e391]: POST
                      - generic [ref=e392]: Created inventory code
                  - cell "Inventory" [ref=e393]
                  - cell "/api/v1/inventory-codes" [ref=e394]
                - row "3m ago 10/11/2026, 7:11:59 PM admin@demo.local PUT Updated setting integrations Settings /api/v1/settings/integrations" [ref=e395] [cursor=pointer]:
                  - cell "3m ago 10/11/2026, 7:11:59 PM" [ref=e396]:
                    - generic [ref=e397]: 3m ago
                    - generic [ref=e398]: 10/11/2026, 7:11:59 PM
                  - cell "admin@demo.local" [ref=e399]
                  - cell "PUT Updated setting integrations" [ref=e400]:
                    - generic [ref=e401]:
                      - generic [ref=e403]: PUT
                      - generic [ref=e404]: Updated setting integrations
                  - cell "Settings" [ref=e405]
                  - cell "/api/v1/settings/integrations" [ref=e406]
                - row "4m ago 10/11/2026, 7:11:46 PM admin@demo.local PUT Updated setting integrations Settings /api/v1/settings/integrations" [ref=e407] [cursor=pointer]:
                  - cell "4m ago 10/11/2026, 7:11:46 PM" [ref=e408]:
                    - generic [ref=e409]: 4m ago
                    - generic [ref=e410]: 10/11/2026, 7:11:46 PM
                  - cell "admin@demo.local" [ref=e411]
                  - cell "PUT Updated setting integrations" [ref=e412]:
                    - generic [ref=e413]:
                      - generic [ref=e415]: PUT
                      - generic [ref=e416]: Updated setting integrations
                  - cell "Settings" [ref=e417]
                  - cell "/api/v1/settings/integrations" [ref=e418]
                - row "4m ago 10/11/2026, 7:11:32 PM admin@demo.local PUT Updated factory settings Organization /api/v1/factories/6acb8c33f0d9467ae068535e/settings" [ref=e419] [cursor=pointer]:
                  - cell "4m ago 10/11/2026, 7:11:32 PM" [ref=e420]:
                    - generic [ref=e421]: 4m ago
                    - generic [ref=e422]: 10/11/2026, 7:11:32 PM
                  - cell "admin@demo.local" [ref=e423]
                  - cell "PUT Updated factory settings" [ref=e424]:
                    - generic [ref=e425]:
                      - generic [ref=e427]: PUT
                      - generic [ref=e428]: Updated factory settings
                  - cell "Organization" [ref=e429]
                  - cell "/api/v1/factories/6acb8c33f0d9467ae068535e/settings" [ref=e430]
                - row "4m ago 10/11/2026, 7:11:15 PM admin@demo.local PUT Updated factory settings Organization /api/v1/factories/6acb8c33f0d9467ae068535e/settings" [ref=e431] [cursor=pointer]:
                  - cell "4m ago 10/11/2026, 7:11:15 PM" [ref=e432]:
                    - generic [ref=e433]: 4m ago
                    - generic [ref=e434]: 10/11/2026, 7:11:15 PM
                  - cell "admin@demo.local" [ref=e435]
                  - cell "PUT Updated factory settings" [ref=e436]:
                    - generic [ref=e437]:
                      - generic [ref=e439]: PUT
                      - generic [ref=e440]: Updated factory settings
                  - cell "Organization" [ref=e441]
                  - cell "/api/v1/factories/6acb8c33f0d9467ae068535e/settings" [ref=e442]
                - row "4m ago 10/11/2026, 7:10:56 PM admin@demo.local PUT Updated setting general Settings /api/v1/settings/general" [ref=e443] [cursor=pointer]:
                  - cell "4m ago 10/11/2026, 7:10:56 PM" [ref=e444]:
                    - generic [ref=e445]: 4m ago
                    - generic [ref=e446]: 10/11/2026, 7:10:56 PM
                  - cell "admin@demo.local" [ref=e447]
                  - cell "PUT Updated setting general" [ref=e448]:
                    - generic [ref=e449]:
                      - generic [ref=e451]: PUT
                      - generic [ref=e452]: Updated setting general
                  - cell "Settings" [ref=e453]
                  - cell "/api/v1/settings/general" [ref=e454]
                - row "5m ago 10/11/2026, 7:10:23 PM admin@demo.local POST Revoked delegation User /api/v1/delegations/6acb91c6f0d9467ae068a53b/revoke" [ref=e455] [cursor=pointer]:
                  - cell "5m ago 10/11/2026, 7:10:23 PM" [ref=e456]:
                    - generic [ref=e457]: 5m ago
                    - generic [ref=e458]: 10/11/2026, 7:10:23 PM
                  - cell "admin@demo.local" [ref=e459]
                  - cell "POST Revoked delegation" [ref=e460]:
                    - generic [ref=e461]:
                      - generic [ref=e463]: POST
                      - generic [ref=e464]: Revoked delegation
                  - cell "User" [ref=e465]
                  - cell "/api/v1/delegations/6acb91c6f0d9467ae068a53b/revoke" [ref=e466]
                - row "5m ago 10/11/2026, 7:10:23 PM admin@demo.local delegation.revoke delegation.revoke Access control —" [ref=e467] [cursor=pointer]:
                  - cell "5m ago 10/11/2026, 7:10:23 PM" [ref=e468]:
                    - generic [ref=e469]: 5m ago
                    - generic [ref=e470]: 10/11/2026, 7:10:23 PM
                  - cell "admin@demo.local" [ref=e471]
                  - cell "delegation.revoke delegation.revoke" [ref=e472]:
                    - generic [ref=e473]:
                      - generic [ref=e475]: delegation.revoke
                      - generic [ref=e476]: delegation.revoke
                  - cell "Access control" [ref=e477]
                  - cell "—" [ref=e478]
                - row "5m ago 10/11/2026, 7:10:22 PM admin@demo.local POST Created delegation User /api/v1/delegations" [ref=e479] [cursor=pointer]:
                  - cell "5m ago 10/11/2026, 7:10:22 PM" [ref=e480]:
                    - generic [ref=e481]: 5m ago
                    - generic [ref=e482]: 10/11/2026, 7:10:22 PM
                  - cell "admin@demo.local" [ref=e483]
                  - cell "POST Created delegation" [ref=e484]:
                    - generic [ref=e485]:
                      - generic [ref=e487]: POST
                      - generic [ref=e488]: Created delegation
                  - cell "User" [ref=e489]
                  - cell "/api/v1/delegations" [ref=e490]
                - row "5m ago 10/11/2026, 7:10:22 PM admin@demo.local delegation.create delegation.create Access control —" [ref=e491] [cursor=pointer]:
                  - cell "5m ago 10/11/2026, 7:10:22 PM" [ref=e492]:
                    - generic [ref=e493]: 5m ago
                    - generic [ref=e494]: 10/11/2026, 7:10:22 PM
                  - cell "admin@demo.local" [ref=e495]
                  - cell "delegation.create delegation.create" [ref=e496]:
                    - generic [ref=e497]:
                      - generic [ref=e499]: delegation.create
                      - generic [ref=e500]: delegation.create
                  - cell "Access control" [ref=e501]
                  - cell "—" [ref=e502]
                - row "6m ago 10/11/2026, 7:08:47 PM admin@demo.local PATCH Updated role User /api/v1/roles/6acb915ff0d9467ae068a47a" [ref=e503] [cursor=pointer]:
                  - cell "6m ago 10/11/2026, 7:08:47 PM" [ref=e504]:
                    - generic [ref=e505]: 6m ago
                    - generic [ref=e506]: 10/11/2026, 7:08:47 PM
                  - cell "admin@demo.local" [ref=e507]
                  - cell "PATCH Updated role" [ref=e508]:
                    - generic [ref=e509]:
                      - generic [ref=e511]: PATCH
                      - generic [ref=e512]: Updated role
                  - cell "User" [ref=e513]
                  - cell "/api/v1/roles/6acb915ff0d9467ae068a47a" [ref=e514]
                - row "6m ago 10/11/2026, 7:08:47 PM admin@demo.local role.update role.update Access control —" [ref=e515] [cursor=pointer]:
                  - cell "6m ago 10/11/2026, 7:08:47 PM" [ref=e516]:
                    - generic [ref=e517]: 6m ago
                    - generic [ref=e518]: 10/11/2026, 7:08:47 PM
                  - cell "admin@demo.local" [ref=e519]
                  - cell "role.update role.update" [ref=e520]:
                    - generic [ref=e521]:
                      - generic [ref=e523]: role.update
                      - generic [ref=e524]: role.update
                  - cell "Access control" [ref=e525]
                  - cell "—" [ref=e526]
                - row "7m ago 10/11/2026, 7:08:40 PM admin@demo.local POST Created role User /api/v1/roles" [ref=e527] [cursor=pointer]:
                  - cell "7m ago 10/11/2026, 7:08:40 PM" [ref=e528]:
                    - generic [ref=e529]: 7m ago
                    - generic [ref=e530]: 10/11/2026, 7:08:40 PM
                  - cell "admin@demo.local" [ref=e531]
                  - cell "POST Created role" [ref=e532]:
                    - generic [ref=e533]:
                      - generic [ref=e535]: POST
                      - generic [ref=e536]: Created role
                  - cell "User" [ref=e537]
                  - cell "/api/v1/roles" [ref=e538]
                - row "7m ago 10/11/2026, 7:08:39 PM admin@demo.local role.create role.create Access control —" [ref=e539] [cursor=pointer]:
                  - cell "7m ago 10/11/2026, 7:08:39 PM" [ref=e540]:
                    - generic [ref=e541]: 7m ago
                    - generic [ref=e542]: 10/11/2026, 7:08:39 PM
                  - cell "admin@demo.local" [ref=e543]
                  - cell "role.create role.create" [ref=e544]:
                    - generic [ref=e545]:
                      - generic [ref=e547]: role.create
                      - generic [ref=e548]: role.create
                  - cell "Access control" [ref=e549]
                  - cell "—" [ref=e550]
                - row "8m ago 10/11/2026, 7:07:09 PM admin@demo.local POST Created user roles User /api/v1/users/6acb90fef0d9467ae068a3d2/roles" [ref=e551] [cursor=pointer]:
                  - cell "8m ago 10/11/2026, 7:07:09 PM" [ref=e552]:
                    - generic [ref=e553]: 8m ago
                    - generic [ref=e554]: 10/11/2026, 7:07:09 PM
                  - cell "admin@demo.local" [ref=e555]
                  - cell "POST Created user roles" [ref=e556]:
                    - generic [ref=e557]:
                      - generic [ref=e559]: POST
                      - generic [ref=e560]: Created user roles
                  - cell "User" [ref=e561]
                  - cell "/api/v1/users/6acb90fef0d9467ae068a3d2/roles" [ref=e562]
                - row "8m ago 10/11/2026, 7:07:09 PM admin@demo.local role.assign role.assign Access control —" [ref=e563] [cursor=pointer]:
                  - cell "8m ago 10/11/2026, 7:07:09 PM" [ref=e564]:
                    - generic [ref=e565]: 8m ago
                    - generic [ref=e566]: 10/11/2026, 7:07:09 PM
                  - cell "admin@demo.local" [ref=e567]
                  - cell "role.assign role.assign" [ref=e568]:
                    - generic [ref=e569]:
                      - generic [ref=e571]: role.assign
                      - generic [ref=e572]: role.assign
                  - cell "Access control" [ref=e573]
                  - cell "—" [ref=e574]
                - row "8m ago 10/11/2026, 7:07:03 PM admin@demo.local POST Created user User /api/v1/users" [ref=e575] [cursor=pointer]:
                  - cell "8m ago 10/11/2026, 7:07:03 PM" [ref=e576]:
                    - generic [ref=e577]: 8m ago
                    - generic [ref=e578]: 10/11/2026, 7:07:03 PM
                  - cell "admin@demo.local" [ref=e579]
                  - cell "POST Created user" [ref=e580]:
                    - generic [ref=e581]:
                      - generic [ref=e583]: POST
                      - generic [ref=e584]: Created user
                  - cell "User" [ref=e585]
                  - cell "/api/v1/users" [ref=e586]
                - row "8m ago 10/11/2026, 7:07:02 PM admin@demo.local user.create user.create Access control —" [ref=e587] [cursor=pointer]:
                  - cell "8m ago 10/11/2026, 7:07:02 PM" [ref=e588]:
                    - generic [ref=e589]: 8m ago
                    - generic [ref=e590]: 10/11/2026, 7:07:02 PM
                  - cell "admin@demo.local" [ref=e591]
                  - cell "user.create user.create" [ref=e592]:
                    - generic [ref=e593]:
                      - generic [ref=e595]: user.create
                      - generic [ref=e596]: user.create
                  - cell "Access control" [ref=e597]
                  - cell "—" [ref=e598]
            - navigation "Pagination" [ref=e599]:
              - paragraph [ref=e600]:
                - generic [ref=e601]: 1–25
                - text: of 42 entries
              - generic [ref=e602]:
                - button "Previous page" [disabled] [ref=e603]:
                  - img [ref=e604]
                  - generic [ref=e606]: Previous
                - button "Next page" [ref=e607] [cursor=pointer]:
                  - generic [ref=e608]: Next
                  - img [ref=e609]
  - region "Notifications"
  - generic [ref=e612]:
    - generic "Drag up or down to reposition" [ref=e613]:
      - img [ref=e614]
    - button "Open messages" [ref=e621]:
      - img [ref=e622]
      - generic: Messages (drag to move)
  - generic:
    - dialog:
      - banner:
        - generic:
          - img
          - generic:
            - heading [level=2]: Messages
        - generic:
          - link:
            - /url: /chat
            - text: All chats
          - button:
            - img
      - generic:
        - generic:
          - generic:
            - generic:
              - generic:
                - generic:
                  - img
                  - searchbox
                - generic:
                  - combobox
                  - button [disabled]: Chat
                  - generic:
                    - button:
                      - img
              - generic:
                - button:
                  - generic: PT
                  - generic:
                    - generic:
                      - paragraph: Production Team
                      - generic: 06:47 PM
                    - paragraph: Fabric receipt expected tomorrow.
                - button:
                  - generic: MO
                  - generic:
                    - generic:
                      - paragraph: Machine Operator
                    - paragraph: No messages
```

# Test source

```ts
  488 |   const was = (await sms.getAttribute('aria-checked')) === 'true';
  489 |   await sms.click();
  490 |   await expect(sms).toHaveAttribute('aria-checked', String(!was));
  491 |   await page.getByRole('region', { name: 'Unsaved changes' }).getByRole('button', { name: /Save/ }).click();
  492 |   await expectToast(page, /saved/i);
  493 |   await page.reload();
  494 |   await expect(page.getByRole('switch', { name: 'SMS sending' })).toHaveAttribute('aria-checked', String(!was));
  495 |   await page.getByRole('switch', { name: 'SMS sending' }).click();
  496 |   await page.getByRole('region', { name: 'Unsaved changes' }).getByRole('button', { name: /Save/ }).click();
  497 |   await expectToast(page, /saved/i);
  498 |   problems.assertNone();
  499 |   await context.close();
  500 | });
  501 | 
  502 | test('Settings: inventory codes create / edit / delete', async ({ browser, request }) => {
  503 |   const { context, page, problems } = await loginAs(browser, request, 'admin');
  504 |   const code = uniq('QA').replace(/-/g, '').slice(0, 10);
  505 |   await page.goto('/settings/inventory-codes');
  506 |   await settle(page);
  507 |   await page.getByRole('button', { name: 'New code' }).first().click();
  508 |   const d = dialog(page, 'New inventory code');
  509 |   await d.getByLabel(/^Code/).fill(code);
  510 |   await d.getByLabel(/^Name/).fill('QA test code');
  511 |   await d.getByRole('button', { name: 'Create code' }).click();
  512 |   await expectToast(page, /created|saved/i);
  513 |   await page.getByPlaceholder(/Search code/).fill(code);
  514 |   const row = page.locator('tbody tr').filter({ hasText: code });
  515 |   await expect(row).toHaveCount(1);
  516 | 
  517 |   await row.getByRole('button', { name: 'More actions' }).click();
  518 |   await page.getByRole('menuitem', { name: /Edit/ }).click();
  519 |   const e = dialog(page, `Edit ${code}`);
  520 |   await e.getByLabel(/^Name/).fill('QA test code edited');
  521 |   await e.getByRole('button', { name: 'Save changes' }).click();
  522 |   await expectToast(page, /saved|updated/i);
  523 |   await expect(row).toContainText('QA test code edited');
  524 | 
  525 |   await row.getByRole('button', { name: 'More actions' }).click();
  526 |   await page.getByRole('menuitem', { name: /Delete/ }).click();
  527 |   await dialog(page, /Delete/).getByRole('button', { name: 'Delete code' }).click();
  528 |   await expectToast(page, /deleted/i);
  529 |   await expect(row).toHaveCount(0);
  530 |   problems.assertNone();
  531 |   await context.close();
  532 | });
  533 | 
  534 | test('My account: wrong current password shows inline error and keeps session; correct one works', async ({ browser, request }) => {
  535 |   // Throwaway user created via API so demo accounts keep their passwords.
  536 |   const admin = api(request, await apiLogin(request, 'admin'));
  537 |   const me = await admin.get('/users/me');
  538 |   const email = `${uniq('pw').toLowerCase()}@demo.local`;
  539 |   const pw1 = 'FirstPass@123';
  540 |   const pw2 = 'SecondPass@456';
  541 |   const user = await admin.post('/users', {
  542 |     email, password: pw1, firstName: 'Pw', lastName: 'Changer', organizationId: me.user.organizationId,
  543 |   });
  544 |   const roles = (await admin.get('/roles')) as Array<{ _id: string; code: string }>;
  545 |   await admin.post(`/users/${user._id}/roles`, {
  546 |     roleId: roles.find((r) => r.code === 'AUDITOR')!._id, factoryId: me.factories[0]._id, organizationId: me.user.organizationId,
  547 |   });
  548 | 
  549 |   const { context, page, problems } = await openSession(browser, await apiLoginAs(request, email, pw1));
  550 |   await page.goto('/');
  551 |   await page.getByRole('button', { name: /Account menu for/ }).click();
  552 |   await page.getByRole('menuitem', { name: 'My account' }).click();
  553 |   await expect(page).toHaveURL(/\/settings\/account$/);
  554 | 
  555 |   await page.getByLabel('Current password').fill('WrongPass@000');
  556 |   await page.getByLabel(/^New password/).fill(pw2);
  557 |   await page.getByLabel('Confirm new password').fill(pw2);
  558 |   await page.getByRole('button', { name: 'Update password' }).click();
  559 |   await expect(page.getByText('Current password is incorrect')).toBeVisible();
  560 |   await expect(page).toHaveURL(/\/settings\/account$/);
  561 |   // Still signed in: navigation works
  562 |   await page.goto('/');
  563 |   await expect(page.locator('#erp-main')).toBeVisible();
  564 |   await expect(page).not.toHaveURL(/login/);
  565 |   problems.assertNone([/error toast: Current password is incorrect/, /console:.*400/]);
  566 |   problems.clear();
  567 | 
  568 |   await page.goto('/settings/account');
  569 |   await page.getByLabel('Current password').fill(pw1);
  570 |   await page.getByLabel(/^New password/).fill(pw2);
  571 |   await page.getByLabel('Confirm new password').fill(pw2);
  572 |   await page.getByRole('button', { name: 'Update password' }).click();
  573 |   await expectToast(page, 'Password changed');
  574 |   expect((await apiLoginWith(request, email, pw1)).ok, 'old password refused').toBeFalsy();
  575 |   expect((await apiLoginWith(request, email, pw2)).ok, 'new password works').toBeTruthy();
  576 |   problems.assertNone();
  577 |   await context.close();
  578 | });
  579 | 
  580 | // ─────────────────────────────── Audit / reports / notifications ───────────────────────────────
  581 | 
  582 | test('Audit log: filters, detail drawer, readable module names', async ({ browser, request }) => {
  583 |   const { context, page, problems } = await loginAs(browser, request, 'admin');
  584 |   await page.goto('/audit');
  585 |   await settle(page);
  586 |   const moduleSel = page.getByLabel('Module');
  587 |   const moduleLabels = await moduleSel.locator('option').allTextContents();
> 588 |   expect(moduleLabels.length).toBeGreaterThan(1);
      |                               ^ Error: expect(received).toBeGreaterThan(expected)
  589 |   for (const l of moduleLabels) expect(l, 'module label readable').not.toMatch(/^v\d+$|^api$/i);
  590 |   const cells = await page.locator('tbody tr td:nth-child(4)').allTextContents();
  591 |   for (const c of cells) expect(c.trim(), 'module cell readable').not.toMatch(/^v\d+$/i);
  592 | 
  593 |   // Filters
  594 |   const firstModule = await moduleSel.locator('option').nth(1).getAttribute('value');
  595 |   await moduleSel.selectOption(firstModule!);
  596 |   await settle(page);
  597 |   await page.getByLabel('Date range').selectOption({ index: 1 });
  598 |   await settle(page);
  599 |   await page.getByLabel('Action', { exact: true }).selectOption({ index: 1 });
  600 |   await settle(page);
  601 |   await page.getByPlaceholder('Filter by user email…').fill('admin@');
  602 |   await settle(page);
  603 |   await page.getByRole('button', { name: 'Clear filters' }).first().click();
  604 |   await expect(page.getByLabel('Module')).toHaveValue('');
  605 |   await settle(page);
  606 | 
  607 |   // Detail drawer
  608 |   await page.locator('tbody tr').first().click();
  609 |   const drawer = page.locator('[role="dialog"]:visible').last();
  610 |   await expect(drawer).toBeVisible();
  611 |   // The module must be a readable name (it used to be "v1" for every request). The endpoint
  612 |   // line legitimately contains /api/v1/, so only check the text right after "Module".
  613 |   await expect(drawer).toContainText(/Module\s*[A-Z][a-z]/);
  614 |   await expect(drawer).not.toContainText(/Module\s*v1/i);
  615 |   await drawer.getByRole('button', { name: 'Close' }).last().click();
  616 |   problems.assertNone();
  617 |   await context.close();
  618 | });
  619 | 
  620 | test('Reports: every tab loads, period filter, export', async ({ browser, request }) => {
  621 |   test.setTimeout(180_000);
  622 |   const { context, page, problems } = await loginAs(browser, request, 'admin');
  623 |   await page.goto('/reports');
  624 |   await expect(page).toHaveURL(/\/reports\/factory$/);
  625 |   await settle(page);
  626 |   const tabs = page.getByRole('tablist').first().getByRole('tab');
  627 |   const n = await tabs.count();
  628 |   expect(n).toBeGreaterThan(1);
  629 |   for (let i = 0; i < n; i++) {
  630 |     problems.clear();
  631 |     await tabs.nth(i).click();
  632 |     await settle(page);
  633 |     await expect(page.locator('[aria-label="Loading report"]')).toHaveCount(0, { timeout: 15_000 });
  634 |     await expect(page.locator('#erp-main')).not.toContainText('NaN');
  635 |     problems.assertNone();
  636 |   }
  637 |   await page.getByLabel('Period').selectOption({ index: 1 });
  638 |   await settle(page);
  639 |   const download = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
  640 |   await page.getByRole('button', { name: 'Export CSV' }).click();
  641 |   const dl = await download;
  642 |   if (!dl) await expectToast(page, /exported/i);
  643 |   problems.assertNone();
  644 |   await context.close();
  645 | });
  646 | 
  647 | test('Notifications page: tabs and filters', async ({ browser, request }) => {
  648 |   const { context, page, problems } = await loginAs(browser, request, 'admin');
  649 |   await page.goto('/notifications');
  650 |   await settle(page);
  651 |   for (const t of ['Unread', 'Read', 'All']) {
  652 |     await page.getByRole('tab', { name: new RegExp(`^${t}`) }).click();
  653 |     await settle(page);
  654 |   }
  655 |   const ev = page.getByLabel('Event type');
  656 |   if (await ev.locator('option').count() > 1) await ev.selectOption({ index: 1 });
  657 |   await settle(page);
  658 |   await page.getByLabel('Period').selectOption({ index: 1 });
  659 |   await settle(page);
  660 |   problems.assertNone();
  661 |   await context.close();
  662 | });
  663 | 
  664 | // ─────────────────────────────── Super admin ───────────────────────────────
  665 | 
  666 | test('Super admin: organizations page', async ({ browser, request }) => {
  667 |   const { context, page, problems } = await loginAs(browser, request, 'superAdmin');
  668 |   await page.goto('/');
  669 |   await page.locator('aside[aria-label="Sidebar"]').getByRole('link', { name: 'Organizations' }).click();
  670 |   await expect(page).toHaveURL(/\/admin\/organizations$/);
  671 |   await settle(page);
  672 |   await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible();
  673 |   await expect(page.locator('tbody tr').first()).toBeVisible();
  674 |   await page.getByPlaceholder('Search organizations…').fill('zzzz-none');
  675 |   await expect(page.getByText('No organizations match')).toBeVisible();
  676 |   problems.assertNone();
  677 |   await context.close();
  678 | 
  679 |   // A factory admin is bounced from the organizations page
  680 |   const fa = await loginAs(browser, request, 'admin');
  681 |   await fa.page.goto('/admin/organizations');
  682 |   await expect(fa.page).toHaveURL(/\/$/);
  683 |   await fa.context.close();
  684 | });
  685 | 
```