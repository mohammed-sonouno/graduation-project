import { AppError } from '../../utils/AppError.js';
import { ConversationRepository } from '../../repositories/conversation.repository.js';
import { MessageRepository } from '../../repositories/message.repository.js';
import { ChatMlRepository } from '../../repositories/chatMl.repository.js';
import { ChatLearningRepository } from '../../repositories/chatLearning.repository.js';
import { UserSafeRepository } from '../../repositories/userSafe.repository.js';
import { DbChatbotEngine } from './engines/dbChatbot.engine.js';
import { perfConfig } from './performance/config.js';
import { shouldIncludeChatDebug } from './chatDebugPolicy.js';
import { resolveMajorPageContext } from './majorPageContext.js';
import { inferReplyLocale, msgNotInDatabase } from './response/safeMessages.js';
import { classifyChatOutcome } from './chatMlOutcome.js';

export class ChatService {
  constructor({
    conversationRepository = new ConversationRepository(),
    messageRepository = new MessageRepository(),
    chatbotEngine = new DbChatbotEngine(),
    chatMlRepository = new ChatMlRepository(),
    chatLearningRepository = new ChatLearningRepository(),
    userSafeRepository = new UserSafeRepository()
  } = {}) {
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
    this.chatbotEngine = chatbotEngine;
    this.chatMl = chatMlRepository;
    this.chatLearning = chatLearningRepository;
    this.userSafe = userSafeRepository;
  }

  async handleUserMessage({ userId, conversationId, message, majorId }) {
    const chatT0 = perfConfig.perfLog ? Date.now() : 0;
    let conversation;
    let majorPage = null;

    if (conversationId) {
      conversation = await this.conversationRepository.getById(conversationId);
      if (!conversation) {
        throw new AppError('Conversation not found', { statusCode: 404, code: 'CONVERSATION_NOT_FOUND' });
      }
      if (conversation.userId !== userId) {
        throw new AppError('Conversation does not belong to this user', {
          statusCode: 403,
          code: 'CONVERSATION_FORBIDDEN'
        });
      }
      const contextKey = majorId || conversation.contextMajorId || null;
      majorPage = contextKey ? await resolveMajorPageContext(contextKey) : null;
      if (majorPage?.majorId) {
        await this.conversationRepository.setContextMajor(conversation.id, majorPage.majorId);
      }
    } else {
      const contextKey = majorId || null;
      majorPage = contextKey ? await resolveMajorPageContext(contextKey) : null;
      conversation = await this.conversationRepository.create({
        userId,
        title: majorPage?.majorName || null,
        contextMajorId: majorPage?.majorId || null
      });
    }

    const userMsg = await this.messageRepository.create({
      conversationId: conversation.id,
      sender: 'user',
      content: message
    });

    const engineResult = await this.chatbotEngine.generate({
      userId,
      conversationId: conversation.id,
      userMessage: message,
      majorPage
    });
    const replyTextRaw = String(engineResult?.replyText || '').trim();
    const localeForFallback =
      engineResult?.debug?.extractedEntities?.replyLocale || inferReplyLocale(message);
    const replyText = replyTextRaw || msgNotInDatabase(localeForFallback, majorPage);

    const botMsg = await this.messageRepository.create({
      conversationId: conversation.id,
      sender: 'bot',
      content: replyText
    });

    await this.conversationRepository.touch(conversation.id);

    const debug = engineResult?.debug ?? null;
    const draftKind = debug?.draftKind ?? null;
    const { outcome, weakReason } = classifyChatOutcome(draftKind, {
      mismatchRecovered: Boolean(debug?.mismatchRecovered)
    });
    let interactionLogId = null;
    try {
      const hints = await this.userSafe.getAcademicHints(userId);
      const replyLocaleResolved = debug?.extractedEntities?.replyLocale || inferReplyLocale(message);
      const debugSourcesPayload = {};
      if (debug?.sources != null) debugSourcesPayload.pipelineSources = debug.sources;
      if (debug?.extractedEntities != null) debugSourcesPayload.extractedEntities = debug.extractedEntities;
      if (debug?.answerValidation != null) debugSourcesPayload.answerValidation = debug.answerValidation;
      if (debug?.mismatchRecovered) debugSourcesPayload.mismatchRecovered = true;
      const debugSources = Object.keys(debugSourcesPayload).length ? debugSourcesPayload : null;
      const answerValidationOk =
        debug?.answerValidation && typeof debug.answerValidation.ok === 'boolean'
          ? debug.answerValidation.ok
          : null;
      interactionLogId = await this.chatMl.insertInteractionLog({
        userId,
        conversationId: conversation.id,
        userMessageId: userMsg.id,
        botMessageId: botMsg.id,
        questionText: message,
        replyText: replyText || '',
        detectedIntent: debug?.intentName ?? null,
        rawIntent: debug?.rawIntentName ?? null,
        planType: debug?.plan?.type ?? null,
        replyLocale: replyLocaleResolved,
        contextMajorId: majorPage?.majorId ?? conversation.contextMajorId ?? null,
        contextProgramKey: majorPage?.programKey ?? null,
        contextCategory: majorPage?.category ?? null,
        userGpaHint: hints.gpa,
        userProfileMajor: hints.profileMajor,
        answerKind: draftKind,
        outcome,
        weakReason,
        answerValidationOk,
        mismatchBlocked: Boolean(debug?.mismatchRecovered),
        debugSources
      });

      if (interactionLogId) {
        try {
          await this.chatLearning.insertLearningSidecars({
            interactionLogId,
            userId,
            conversationId: conversation.id,
            userMessageId: userMsg.id,
            botMessageId: botMsg.id,
            questionText: message,
            replyText: replyText || '',
            detectedIntent: debug?.intentName ?? null,
            rawIntent: debug?.rawIntentName ?? null,
            planType: debug?.plan?.type ?? null,
            answerKind: draftKind,
            replyLocale: replyLocaleResolved,
            contextMajorId: majorPage?.majorId ?? conversation.contextMajorId ?? null,
            contextProgramKey: majorPage?.programKey ?? null,
            contextCategory: majorPage?.category ?? null,
            extractedEntities: debug?.extractedEntities ?? null,
            pipelineSources: debug?.sources ?? null,
            validationOk: answerValidationOk,
            mismatchBlocked: Boolean(debug?.mismatchRecovered),
            outcome,
            weakReason
          });
        } catch (learnErr) {
          console.error('chat_learning sidecar insert failed:', learnErr?.message || learnErr);
        }
      }
    } catch (logErr) {
      console.error('chat_ml log insert failed:', logErr?.message || logErr);
    }

    if (perfConfig.perfLog) {
      console.log(JSON.stringify({ tag: 'chatbot.chat', phase: 'handleUserMessage', ms: Date.now() - chatT0 }));
    }

    return {
      conversationId: conversation.id,
      userMessage: userMsg,
      botMessage: botMsg,
      interactionLogId,
      outcome,
      weakReason,
      debug: shouldIncludeChatDebug() ? debug : null
    };
  }
}
