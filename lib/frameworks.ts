export type QuestionStatus = "yes" | "no" | "partial" | "na" | null;

export interface Question {
  id: string;
  text: string;
  guidance: string;
  priority: "critical" | "high" | "medium";
}

export interface Section {
  id: string;
  title: string;
  questions: Question[];
}

export interface Framework {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  colour: string;
  sections: Section[];
}

export const frameworks: Framework[] = [
  {
    id: "kcsie",
    title: "Keeping Children Safe in Education (KCSiE)",
    shortTitle: "KCSiE",
    description:
      "Statutory DfE guidance on safeguarding and child protection including online safety requirements for all schools.",
    colour: "blue",
    sections: [
      {
        id: "kcsie-online-safety",
        title: "Online Safety",
        questions: [
          {
            id: "kcsie-1",
            text: "Does the school have an up-to-date online safety policy reviewed at least annually?",
            guidance:
              "KCSiE Part 2 requires schools to have a clear policy on online safety. This should be part of the wider safeguarding policy.",
            priority: "critical",
          },
          {
            id: "kcsie-2",
            text: "Is there appropriate filtering of harmful online content on all school devices and networks?",
            guidance:
              "Schools must ensure appropriate filters are in place and are regularly reviewed. Filters should block illegal content as a minimum.",
            priority: "critical",
          },
          {
            id: "kcsie-3",
            text: "Is there appropriate monitoring of online activity on school networks and devices?",
            guidance:
              "KCSiE requires monitoring alongside filtering. Staff and pupils should be aware monitoring takes place.",
            priority: "critical",
          },
          {
            id: "kcsie-4",
            text: "Are all staff trained on online safety as part of induction and regular refresher training?",
            guidance:
              "All staff should receive training so they understand their responsibilities and can identify concerns.",
            priority: "high",
          },
          {
            id: "kcsie-5",
            text: "Is online safety taught to pupils as part of the curriculum?",
            guidance:
              "Relationships and Health Education (RHE) statutory guidance requires online safety to be taught to all pupils.",
            priority: "high",
          },
          {
            id: "kcsie-6",
            text: "Does the school have a named Designated Safeguarding Lead (DSL) with responsibility for online safety?",
            guidance:
              "The DSL should be the first point of contact for online safety concerns and have appropriate training.",
            priority: "critical",
          },
        ],
      },
      {
        id: "kcsie-devices",
        title: "Devices & Access",
        questions: [
          {
            id: "kcsie-7",
            text: "Are school-issued devices configured to apply safeguarding controls even when used off-site?",
            guidance:
              "Filtering and monitoring should follow the device, not just the school network.",
            priority: "high",
          },
          {
            id: "kcsie-8",
            text: "Is there an Acceptable Use Policy (AUP) for staff and pupils covering use of school IT?",
            guidance:
              "AUPs should be signed by staff and pupils (with parental consent for younger children) and reviewed annually.",
            priority: "high",
          },
          {
            id: "kcsie-9",
            text: "Are there clear procedures for reporting online safety concerns?",
            guidance:
              "Staff, pupils and parents should know how to report concerns. This should be clearly communicated.",
            priority: "high",
          },
        ],
      },
    ],
  },
  {
    id: "filtering-monitoring",
    title: "DfE Filtering & Monitoring Standards (2023)",
    shortTitle: "DfE Filtering",
    description:
      "DfE statutory standards requiring schools to have appropriate filtering and monitoring in place as of September 2023.",
    colour: "purple",
    sections: [
      {
        id: "fm-filtering",
        title: "Filtering",
        questions: [
          {
            id: "fm-1",
            text: "Does the filtering solution block illegal content (IWF list, terrorist content)?",
            guidance:
              "As a minimum, filtering must block content on the Internet Watch Foundation (IWF) URL list and content promoting terrorism.",
            priority: "critical",
          },
          {
            id: "fm-2",
            text: "Does the filtering solution block categories of harmful content appropriate for the age of pupils?",
            guidance:
              "Age-appropriate filtering should go beyond illegal content to include pornography, violence, and self-harm content.",
            priority: "critical",
          },
          {
            id: "fm-3",
            text: "Is the filtering solution reviewed at least annually by a governor or trustee?",
            guidance:
              "DfE standards require a nominated governor or trustee to review filtering and monitoring provision annually.",
            priority: "high",
          },
          {
            id: "fm-4",
            text: "Does the school have a process for reviewing and updating the filtering solution?",
            guidance:
              "Schools should be able to respond quickly to emerging threats and adjust filtering categories as needed.",
            priority: "high",
          },
          {
            id: "fm-5",
            text: "Is filtering applied to all devices used by pupils, including those connecting via personal mobile data?",
            guidance:
              "Consider how to address pupils using personal devices or mobile data to bypass school filtering.",
            priority: "medium",
          },
        ],
      },
      {
        id: "fm-monitoring",
        title: "Monitoring",
        questions: [
          {
            id: "fm-6",
            text: "Does the school have appropriate monitoring in place that can identify concerns?",
            guidance:
              "Monitoring should be proportionate and capable of identifying safeguarding risks and policy breaches.",
            priority: "critical",
          },
          {
            id: "fm-7",
            text: "Are monitoring alerts reviewed promptly by a responsible member of staff?",
            guidance:
              "Monitoring is only effective if alerts are acted on. There should be a clear process and named person responsible.",
            priority: "high",
          },
          {
            id: "fm-8",
            text: "Are staff and pupils informed that monitoring takes place?",
            guidance:
              "Transparency about monitoring is required. This should be covered in the AUP and communicated to all users.",
            priority: "high",
          },
          {
            id: "fm-9",
            text: "Does the school have a nominated governor/trustee lead for filtering and monitoring?",
            guidance:
              "DfE requires a nominated governor or trustee to take responsibility for oversight of filtering and monitoring.",
            priority: "high",
          },
        ],
      },
    ],
  },
  {
    id: "cyber-essentials",
    title: "Cyber Essentials (NCSC)",
    shortTitle: "Cyber Essentials",
    description:
      "NCSC government-backed scheme covering five technical controls to protect against the most common cyber attacks.",
    colour: "green",
    sections: [
      {
        id: "ce-firewall",
        title: "Firewalls",
        questions: [
          {
            id: "ce-1",
            text: "Is a boundary firewall in place to protect the school network from the internet?",
            guidance:
              "A firewall should be configured to block unauthorised access to and from the school network.",
            priority: "critical",
          },
          {
            id: "ce-2",
            text: "Is the firewall configured to block inbound connections by default, only allowing what is necessary?",
            guidance:
              "Default-deny inbound rules ensure only approved traffic can reach school systems.",
            priority: "critical",
          },
          {
            id: "ce-3",
            text: "Are firewall rules reviewed regularly and unused rules removed?",
            guidance:
              "Firewall rules should be reviewed at least annually to remove unnecessary access.",
            priority: "high",
          },
        ],
      },
      {
        id: "ce-secure-config",
        title: "Secure Configuration",
        questions: [
          {
            id: "ce-4",
            text: "Are default passwords changed on all new devices and software before deployment?",
            guidance:
              "Default credentials are widely known and must be changed immediately on setup.",
            priority: "critical",
          },
          {
            id: "ce-5",
            text: "Is unnecessary software and services removed or disabled on school devices?",
            guidance:
              "Reducing the attack surface by removing unused software and services is a key security practice.",
            priority: "high",
          },
          {
            id: "ce-6",
            text: "Is auto-run disabled on removable media (USB drives) on school computers?",
            guidance:
              "Auto-run can allow malware to execute automatically when a USB is inserted.",
            priority: "high",
          },
        ],
      },
      {
        id: "ce-access-control",
        title: "Access Control",
        questions: [
          {
            id: "ce-7",
            text: "Do staff and pupils have separate accounts with only the access they need (least privilege)?",
            guidance:
              "User accounts should be limited to the minimum access required to perform their role.",
            priority: "critical",
          },
          {
            id: "ce-8",
            text: "Are administrative/privileged accounts only used for administrative tasks?",
            guidance:
              "Admin accounts should not be used for day-to-day activities like browsing the web or reading email.",
            priority: "high",
          },
          {
            id: "ce-9",
            text: "Is multi-factor authentication (MFA) enabled for all remote access and administrator accounts?",
            guidance:
              "MFA significantly reduces the risk of account compromise, especially for privileged accounts.",
            priority: "critical",
          },
          {
            id: "ce-10",
            text: "Are leaver accounts disabled promptly when staff leave the school?",
            guidance:
              "Accounts for former staff must be disabled on or before their last day.",
            priority: "high",
          },
        ],
      },
      {
        id: "ce-malware",
        title: "Malware Protection",
        questions: [
          {
            id: "ce-11",
            text: "Is up-to-date anti-malware software installed on all school devices?",
            guidance:
              "Anti-malware should be active, up to date, and configured to scan automatically.",
            priority: "critical",
          },
          {
            id: "ce-12",
            text: "Is anti-malware configured to update automatically and scan at regular intervals?",
            guidance:
              "Automatic updates ensure protection against the latest threats without relying on manual action.",
            priority: "high",
          },
        ],
      },
      {
        id: "ce-patching",
        title: "Patch Management",
        questions: [
          {
            id: "ce-13",
            text: "Are operating systems and software kept up to date with security patches applied within 14 days?",
            guidance:
              "Cyber Essentials requires critical patches to be applied within 14 days of release.",
            priority: "critical",
          },
          {
            id: "ce-14",
            text: "Is unsupported software (software that no longer receives security updates) removed or isolated?",
            guidance:
              "Software that no longer receives security updates represents a significant risk and should be replaced.",
            priority: "critical",
          },
          {
            id: "ce-15",
            text: "Is there a process in place to identify and track software versions across all school devices?",
            guidance:
              "An asset and software inventory helps ensure nothing is missed in the patching process.",
            priority: "high",
          },
        ],
      },
    ],
  },
  {
    id: "gdpr",
    title: "UK GDPR & Data Protection Act 2018",
    shortTitle: "UK GDPR",
    description:
      "ICO requirements for how schools collect, store, use, and protect personal data of pupils, staff, and parents.",
    colour: "orange",
    sections: [
      {
        id: "gdpr-governance",
        title: "Governance & Accountability",
        questions: [
          {
            id: "gdpr-1",
            text: "Is the school registered with the ICO as a data controller?",
            guidance:
              "All schools that process personal data must be registered with the ICO and pay the data protection fee.",
            priority: "critical",
          },
          {
            id: "gdpr-2",
            text: "Has the school appointed a Data Protection Officer (DPO) or identified a responsible person?",
            guidance:
              "Schools are public authorities and must appoint a DPO. This role can be shared or outsourced.",
            priority: "critical",
          },
          {
            id: "gdpr-3",
            text: "Does the school maintain a Record of Processing Activities (ROPA)?",
            guidance:
              "A ROPA documents all personal data processing activities and is required under Article 30 of UK GDPR.",
            priority: "high",
          },
          {
            id: "gdpr-4",
            text: "Is there a published Privacy Notice on the school website for pupils and parents?",
            guidance:
              "Schools must be transparent about how they use personal data. Privacy notices must be clear and accessible.",
            priority: "high",
          },
        ],
      },
      {
        id: "gdpr-security",
        title: "Data Security",
        questions: [
          {
            id: "gdpr-5",
            text: "Is personal data encrypted when stored on portable devices or sent outside the school network?",
            guidance:
              "Encryption protects data in transit and at rest, reducing the impact of loss or theft.",
            priority: "critical",
          },
          {
            id: "gdpr-6",
            text: "Are staff trained on data protection and their responsibilities under UK GDPR?",
            guidance:
              "Regular training ensures staff understand what constitutes a data breach and how to handle personal data.",
            priority: "high",
          },
          {
            id: "gdpr-7",
            text: "Does the school have a data breach response procedure and know how to report to the ICO?",
            guidance:
              "Breaches must be reported to the ICO within 72 hours if they pose a risk to individuals.",
            priority: "critical",
          },
          {
            id: "gdpr-8",
            text: "Are data retention periods defined and old data disposed of securely?",
            guidance:
              "Data should not be kept longer than necessary. The Records Management Society has guidance for schools.",
            priority: "high",
          },
        ],
      },
      {
        id: "gdpr-third-party",
        title: "Third Parties & Processors",
        questions: [
          {
            id: "gdpr-9",
            text: "Are Data Processing Agreements (DPAs) in place with all third-party providers who process personal data?",
            guidance:
              "Any supplier processing personal data on the school's behalf must have a DPA in place.",
            priority: "high",
          },
          {
            id: "gdpr-10",
            text: "Has the school checked that cloud providers store data within the UK/EEA or have appropriate safeguards?",
            guidance:
              "Transferring personal data outside the UK requires appropriate safeguards such as Standard Contractual Clauses.",
            priority: "high",
          },
        ],
      },
    ],
  },
  {
    id: "online-safety-act",
    title: "Online Safety Act 2023",
    shortTitle: "Online Safety Act",
    description:
      "Legislation placing new duties on schools regarding online safety education and protecting pupils from harmful content.",
    colour: "red",
    sections: [
      {
        id: "osa-education",
        title: "Online Safety Education",
        questions: [
          {
            id: "osa-1",
            text: "Does the school deliver online safety education that covers risks from user-generated content and social media?",
            guidance:
              "The Online Safety Act 2023 places greater emphasis on educating pupils about risks on social media platforms.",
            priority: "high",
          },
          {
            id: "osa-2",
            text: "Are pupils taught about the risks of sharing personal information online?",
            guidance:
              "Pupils should understand the permanence of online content and the risks of oversharing personal information.",
            priority: "high",
          },
          {
            id: "osa-3",
            text: "Does online safety education cover cyberbullying and how to report it?",
            guidance:
              "Pupils should know what cyberbullying is, how to recognise it, and how to seek help.",
            priority: "high",
          },
          {
            id: "osa-4",
            text: "Are parents and carers provided with guidance on online safety to support learning at home?",
            guidance:
              "Parental engagement is key to effective online safety. Schools should provide resources and run awareness sessions.",
            priority: "medium",
          },
        ],
      },
      {
        id: "osa-policy",
        title: "Policy & Reporting",
        questions: [
          {
            id: "osa-5",
            text: "Does the school have a clear procedure for pupils to report online harm or abuse?",
            guidance:
              "Pupils must feel safe reporting concerns. Multiple reporting routes should be available.",
            priority: "critical",
          },
          {
            id: "osa-6",
            text: "Is the online safety policy updated to reflect the Online Safety Act 2023 requirements?",
            guidance:
              "Policies should be reviewed following the Act's implementation to ensure they reflect current legislation.",
            priority: "high",
          },
        ],
      },
    ],
  },
  {
    id: "ofsted",
    title: "Ofsted Inspection Framework",
    shortTitle: "Ofsted",
    description:
      "IT and safeguarding elements that Ofsted inspectors look for when inspecting primary schools.",
    colour: "yellow",
    sections: [
      {
        id: "ofsted-safeguarding",
        title: "Safeguarding & IT",
        questions: [
          {
            id: "ofsted-1",
            text: "Can senior leaders demonstrate they understand online risks and have taken appropriate action?",
            guidance:
              "Inspectors will ask leaders about their understanding of online risks and what steps they have taken.",
            priority: "high",
          },
          {
            id: "ofsted-2",
            text: "Is the single central record (SCR) up to date and does it include IT-related vetting checks?",
            guidance:
              "The SCR must be accurate. All staff with access to pupil data or systems should be appropriately vetted.",
            priority: "critical",
          },
          {
            id: "ofsted-3",
            text: "Can the school evidence that filtering and monitoring is effective and regularly reviewed?",
            guidance:
              "Inspectors will look for evidence of review and impact. Keep records of reviews and any actions taken.",
            priority: "high",
          },
          {
            id: "ofsted-4",
            text: "Are pupils able to talk about online safety and what they should do if they encounter something upsetting?",
            guidance:
              "Inspectors may speak to pupils. Pupils should be able to articulate what they have learned about online safety.",
            priority: "high",
          },
          {
            id: "ofsted-5",
            text: "Is IT used effectively to support teaching and learning, with appropriate staff training?",
            guidance:
              "Ofsted considers how effectively IT is used to support good outcomes for pupils.",
            priority: "medium",
          },
        ],
      },
    ],
  },
];

export function calculateScore(answers: Record<string, QuestionStatus>): {
  total: number;
  answered: number;
  yes: number;
  partial: number;
  no: number;
  percentage: number;
  rag: "red" | "amber" | "green";
} {
  const values = Object.values(answers).filter((v) => v !== null && v !== "na");
  const yes = values.filter((v) => v === "yes").length;
  const partial = values.filter((v) => v === "partial").length;
  const no = values.filter((v) => v === "no").length;
  const answered = values.length;
  const score = yes + partial * 0.5;
  const percentage = answered > 0 ? Math.round((score / answered) * 100) : 0;
  const rag =
    percentage >= 75 ? "green" : percentage >= 50 ? "amber" : "red";
  return { total: answered, answered, yes, partial, no, percentage, rag };
}

export function getFrameworkScore(
  frameworkId: string,
  answers: Record<string, QuestionStatus>
) {
  const framework = frameworks.find((f) => f.id === frameworkId);
  if (!framework) return null;
  const frameworkQuestionIds = framework.sections.flatMap((s) =>
    s.questions.map((q) => q.id)
  );
  const frameworkAnswers: Record<string, QuestionStatus> = {};
  frameworkQuestionIds.forEach((id) => {
    frameworkAnswers[id] = answers[id] ?? null;
  });
  return calculateScore(frameworkAnswers);
}

export function getTotalQuestions(): number {
  return frameworks.reduce(
    (acc, f) =>
      acc + f.sections.reduce((a, s) => a + s.questions.length, 0),
    0
  );
}
