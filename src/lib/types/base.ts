import type { Permission } from '$lib/stores/auth';

export type ExtendType<T, K extends keyof T, V> = Omit<T, K> & { [P in K]?: V };

export interface ParentResource {
    id: number;
    code: string;
    displayName: string;
    complexityLevel: string;
}

export interface ResourceContentStatus {
    status: ResourceContentStatusEnum;
    displayName: string;
}

export enum ResourceContentStatusEnum {
    None = 'None',
    New = 'New',
    AquiferizeEditorReview = 'AquiferizeEditorReview',
    Complete = 'Complete',
    AquiferizeReviewPending = 'AquiferizeReviewPending',
    AquiferizePublisherReview = 'AquiferizePublisherReview',
    AquiferizeAwaitingAiDraft = 'AquiferizeAwaitingAiDraft',
    TranslationAwaitingAiDraft = 'TranslationAwaitingAiDraft',
    TranslationEditorReview = 'TranslationEditorReview',
    TranslationReviewPending = 'TranslationReviewPending',
    TranslationPublisherReview = 'TranslationPublisherReview',
    OnHold = 'OnHold',
    AquiferizeCompanyReview = 'AquiferizeCompanyReview',
    AquiferizeAiDraftComplete = 'AquiferizeAiDraftComplete',
    TranslationCompanyReview = 'TranslationCompanyReview',
    TranslationAiDraftComplete = 'TranslationAiDraftComplete',
    TranslationNotApplicable = 'TranslationNotApplicable',
    CompleteNotApplicable = 'CompleteNotApplicable',
}

export enum ResourceContentStatusDisplayEnum {
    None = 'None',
    New = 'New',
    AquiferizeEditorReview = 'Aquiferize - Editor Review',
    Complete = 'Complete',
    AquiferizeReviewPending = 'Aquiferize - Review Pending',
    AquiferizePublisherReview = 'Aquiferize - Publisher Review',
    AquiferizeAwaitingAiDraft = 'Aquiferize - Awaiting AI Draft',
    TranslationAwaitingAiDraft = 'Translation - Awaiting AI Draft',
    TranslationEditorReview = 'Translation - Editor Review',
    TranslationReviewPending = 'Translation - Review Pending',
    TranslationPublisherReview = 'Translation - Publisher Review',
    OnHold = 'On Hold',
    AquiferizeCompanyReview = 'Aquiferize - Company Review',
    AquiferizeAiDraftComplete = 'Aquiferize - AI Draft Complete',
    TranslationCompanyReview = 'Translation - Company Review',
    TranslationAiDraftComplete = 'Translation - AI Draft Complete',
    TranslationNotApplicable = 'Translation - Not Applicable',
    CompleteNotApplicable = 'Complete - Not Applicable',
}

export const companiesToIgnore = ['BiblioNexus', 'Temp - Deleted Users', 'N/A'];

export const statusColorMap: Record<ResourceContentStatusEnum, string> = {
    [ResourceContentStatusEnum.None]: '#6e7580',
    [ResourceContentStatusEnum.New]: '#6e7580',
    [ResourceContentStatusEnum.AquiferizeEditorReview]: '#00a3e0',
    [ResourceContentStatusEnum.Complete]: '#19b26b',
    [ResourceContentStatusEnum.AquiferizeReviewPending]: '#f79008',
    [ResourceContentStatusEnum.AquiferizePublisherReview]: '#6172f3',
    [ResourceContentStatusEnum.AquiferizeAwaitingAiDraft]: '#6e7580',
    [ResourceContentStatusEnum.TranslationAwaitingAiDraft]: '#6e7580',
    [ResourceContentStatusEnum.TranslationEditorReview]: '#00a3e0',
    [ResourceContentStatusEnum.TranslationReviewPending]: '#f79008',
    [ResourceContentStatusEnum.TranslationPublisherReview]: '#6172f3',
    [ResourceContentStatusEnum.OnHold]: '#6e7580',
    [ResourceContentStatusEnum.AquiferizeCompanyReview]: '#6172f3',
    [ResourceContentStatusEnum.AquiferizeAiDraftComplete]: '#6e7580',
    [ResourceContentStatusEnum.TranslationCompanyReview]: '#6172f3',
    [ResourceContentStatusEnum.TranslationAiDraftComplete]: '#6e7580',
    [ResourceContentStatusEnum.TranslationNotApplicable]: '#6e7580',
    [ResourceContentStatusEnum.CompleteNotApplicable]: '#19b26b',
};

export enum ScriptDirection {
    RTL = 'rtl',
    LTR = 'ltr',
}

export interface Language {
    id: number;
    iso6393Code: string;
    englishDisplay: string;
    displayName: string;
    isActive: boolean;
    scriptDirection: ScriptDirection;
}

export interface BasicUser {
    id: number;
    name: string;
}

export enum UserRole {
    None = 'None',
    Editor = 'Editor',
    Manager = 'Manager',
    Publisher = 'Publisher',
    Admin = 'Admin',
    ReportViewer = 'ReportViewer',
    CommunityReviewer = 'CommunityReviewer',
    Reviewer = 'Reviewer',
}

export interface User extends BasicUser {
    role: UserRole;
    company: Company;
    isEmailVerified: string;
    email: string;
}

export interface CurrentUser extends BasicUser {
    permissions: Permission[];
    roles: UserRole[];
    company: { id: number; languageIds: number[] };
    languageId: number | null;
    canBeAssignedContent: boolean;
}

export interface BibleBook {
    number: number;
    code: string;
    localizedName: string;
    totalChapters: number;
    chapters: { number: number; totalVerses: number }[];
}

export interface Company {
    id: number;
    name: string;
}

export enum ApiKeyScope {
    None = 'None',
    All = 'All',
    InternalApi = 'InternalApi',
    PublicApi = 'PublicApi',
    Admin = 'Admin',
    WellApi = 'WellApi',
}

export interface TranslationPair {
    languageId: number;
    translationPairId: number;
    languageEnglishDisplay: string;
    translationPairKey: string;
    translationPairValue: string;
}
