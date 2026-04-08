import type { Customer } from './types';

export const customers: Customer[] = [
  {
    customerId: 'CUST-001',
    name: 'Hill Country Builders',
    accountNumber: 'HCB-2024-001',
    contacts: [
      { name: 'Mike Torres', role: 'Project Manager', phone: '(512) 555-1001', email: 'mtorres@hcbuilders.com' },
      { name: 'Sarah Chen', role: 'Superintendent', phone: '(512) 555-1002', email: 'schen@hcbuilders.com' },
    ],
    jobSites: [
      {
        siteId: 'SITE-001',
        name: 'Lakewood Estates Phase 2',
        address: '800 Lakewood Dr',
        city: 'Austin',
        state: 'TX',
        latitude: 30.3100,
        longitude: -97.7500,
        gateCode: '4521',
        siteContact: 'Sarah Chen',
        siteContactPhone: '(512) 555-1002',
      },
    ],
  },
  {
    customerId: 'CUST-002',
    name: 'Lone Star Commercial',
    accountNumber: 'LSC-2024-002',
    contacts: [
      { name: 'James Walker', role: 'VP Operations', phone: '(512) 555-2001', email: 'jwalker@lonestarcomm.com' },
    ],
    jobSites: [
      {
        siteId: 'SITE-002',
        name: 'Domain Tower III',
        address: '11500 Domain Dr',
        city: 'Austin',
        state: 'TX',
        latitude: 30.4020,
        longitude: -97.7250,
        siteContact: 'James Walker',
        siteContactPhone: '(512) 555-2001',
      },
    ],
  },
  {
    customerId: 'CUST-003',
    name: 'Capital City Concrete Works',
    accountNumber: 'CCC-2024-003',
    contacts: [
      { name: 'Lisa Nguyen', role: 'Owner', phone: '(512) 555-3001', email: 'lisa@capcityconcrete.com' },
    ],
    jobSites: [
      {
        siteId: 'SITE-003',
        name: 'Mueller Mixed-Use Development',
        address: '4200 Mueller Blvd',
        city: 'Austin',
        state: 'TX',
        latitude: 30.2980,
        longitude: -97.7050,
        gateCode: '7788',
        siteContact: 'Lisa Nguyen',
        siteContactPhone: '(512) 555-3001',
      },
    ],
  },
  {
    customerId: 'CUST-004',
    name: 'Texan Foundation Specialists',
    accountNumber: 'TFS-2024-004',
    contacts: [
      { name: 'Roberto Garza', role: 'Foreman', phone: '(512) 555-4001', email: 'rgarza@texanfound.com' },
    ],
    jobSites: [
      {
        siteId: 'SITE-004',
        name: 'Barton Creek Residences',
        address: '3100 Barton Creek Blvd',
        city: 'Austin',
        state: 'TX',
        latitude: 30.2600,
        longitude: -97.8100,
        siteContact: 'Roberto Garza',
        siteContactPhone: '(512) 555-4001',
      },
    ],
  },
  {
    customerId: 'CUST-005',
    name: 'Austin Paving & Grading',
    accountNumber: 'APG-2024-005',
    contacts: [
      { name: 'Tom Bradley', role: 'Operations Mgr', phone: '(512) 555-5001', email: 'tbradley@austinpaving.com' },
    ],
    jobSites: [
      {
        siteId: 'SITE-005',
        name: 'Mopac Interchange Improvement',
        address: 'Mopac & Parmer Ln',
        city: 'Austin',
        state: 'TX',
        latitude: 30.4400,
        longitude: -97.7400,
        siteContact: 'Tom Bradley',
        siteContactPhone: '(512) 555-5001',
      },
    ],
  },
  {
    customerId: 'CUST-006',
    name: 'Precision Structures Inc',
    accountNumber: 'PSI-2024-006',
    contacts: [
      { name: 'Amanda Phillips', role: 'Project Eng', phone: '(512) 555-6001', email: 'aphillips@precisionstr.com' },
    ],
    jobSites: [
      {
        siteId: 'SITE-006',
        name: 'South Congress Parking Garage',
        address: '1800 S Congress Ave',
        city: 'Austin',
        state: 'TX',
        latitude: 30.2450,
        longitude: -97.7490,
        siteContact: 'Amanda Phillips',
        siteContactPhone: '(512) 555-6001',
      },
    ],
  },
  {
    customerId: 'CUST-007',
    name: 'Bluebonnet Development Group',
    accountNumber: 'BDG-2024-007',
    contacts: [
      { name: 'Derek Kim', role: 'Site Manager', phone: '(512) 555-7001', email: 'dkim@bluebonnetdev.com' },
    ],
    jobSites: [
      {
        siteId: 'SITE-007',
        name: 'Pflugerville Town Center',
        address: '100 Town Center Dr',
        city: 'Pflugerville',
        state: 'TX',
        latitude: 30.4390,
        longitude: -97.6200,
        gateCode: '1234',
        siteContact: 'Derek Kim',
        siteContactPhone: '(512) 555-7001',
      },
    ],
  },
  {
    customerId: 'CUST-008',
    name: 'Cedar Park Construction',
    accountNumber: 'CPC-2024-008',
    contacts: [
      { name: 'Rachel Morrison', role: 'Superintendent', phone: '(512) 555-8001', email: 'rmorrison@cedarparkconstruction.com' },
    ],
    jobSites: [
      {
        siteId: 'SITE-008',
        name: 'Cedar Park High School Expansion',
        address: '2150 Cypress Creek Rd',
        city: 'Cedar Park',
        state: 'TX',
        latitude: 30.5150,
        longitude: -97.8200,
        siteContact: 'Rachel Morrison',
        siteContactPhone: '(512) 555-8001',
      },
    ],
  },
  {
    customerId: 'CUST-009',
    name: 'Rio Grande Masonry',
    accountNumber: 'RGM-2024-009',
    contacts: [
      { name: 'Carlos Mendez', role: 'Owner', phone: '(512) 555-9001', email: 'cmendez@riograndemasonry.com' },
    ],
    jobSites: [
      {
        siteId: 'SITE-009',
        name: 'East Riverside Condos',
        address: '2400 E Riverside Dr',
        city: 'Austin',
        state: 'TX',
        latitude: 30.2350,
        longitude: -97.7200,
        siteContact: 'Carlos Mendez',
        siteContactPhone: '(512) 555-9001',
      },
    ],
  },
  {
    customerId: 'CUST-010',
    name: 'Summit Builders LLC',
    accountNumber: 'SBL-2024-010',
    contacts: [
      { name: 'Patricia Hong', role: 'Project Director', phone: '(512) 555-0010', email: 'phong@summitbuilders.com' },
    ],
    jobSites: [
      {
        siteId: 'SITE-010',
        name: 'Bee Cave Office Park',
        address: '12900 Bee Cave Pkwy',
        city: 'Bee Cave',
        state: 'TX',
        latitude: 30.3080,
        longitude: -97.9400,
        siteContact: 'Patricia Hong',
        siteContactPhone: '(512) 555-0010',
      },
    ],
  },
];
