/*
 *  Copyright (c) 2018-present, Evgeny Nadymov
 *
 * This source code is licensed under the GPL v.3.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
    getChatTypingString,
    getChatDraft,
    getLastMessageSenderName,
    getLastMessageContent,
    showChatDraft
} from '../../Utils/Chat';
import ChatStore from '../../Stores/ChatStore';
import './DialogContentControl.css';

class DialogContentControl extends React.Component {
    constructor(props) {
        super(props);
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (nextProps.chatId !== this.props.chatId) {
            return true;
        }

        return false;
    }

    componentDidMount() {
        ChatStore.on('clientUpdateFastUpdatingComplete', this.onFastUpdatingComplete);
        ChatStore.on('clientUpdateClearHistory', this.onClientUpdateClearHistory);
        ChatStore.on('updateChatDraftMessage', this.onUpdate);
        ChatStore.on('updateChatLastMessage', this.onUpdate);
        ChatStore.on('updateChatReadInbox', this.onUpdate);
        ChatStore.on('updateUserChatAction', this.onUpdate);
    }

    componentWillUnmount() {
        ChatStore.removeListener('clientUpdateFastUpdatingComplete', this.onFastUpdatingComplete);
        ChatStore.removeListener('clientUpdateClearHistory', this.onClientUpdateClearHistory);
        ChatStore.removeListener('updateChatDraftMessage', this.onUpdate);
        ChatStore.removeListener('updateChatLastMessage', this.onUpdate);
        ChatStore.removeListener('updateChatReadInbox', this.onUpdate);
        ChatStore.removeListener('updateUserChatAction', this.onUpdate);
    }

    onClientUpdateClearHistory = update => {
        const { chatId } = this.props;

        if (chatId === update.chatId) {
            this.clearHistory = update.inProgress;
            this.forceUpdate();
        }
    };

    onFastUpdatingComplete = update => {
        this.forceUpdate();
    };

    onUpdate = update => {
        const { chatId } = this.props;

        if (chatId !== update.chat_id) return;

        this.forceUpdate();
    };

    render() {
        if (this.clearHistory) return <div className='dialog-content'>{'\u00A0'}</div>;

        const { chatId } = this.props;

        const chat = ChatStore.get(chatId);
        if (!chat) return <div className='dialog-content'>{'\u00A0'}</div>;

        let contentControl = null;
        const typingString = getChatTypingString(chatId);
        if (typingString) {
            contentControl = <span className='dialog-content-accent'>{typingString}</span>;
        }

        if (!contentControl) {
            const draft = getChatDraft(chat);
            if (showChatDraft(chat)) {
                const text = draft.text || '\u00A0';

                contentControl = (
                    <>
                        <span className='dialog-content-draft'>Draft: </span>
                        {text}
                    </>
                );
            }
        }

        if (!contentControl) {
            const content = getLastMessageContent(chat) || '\u00A0';
            const senderName = getLastMessageSenderName(chat);
            contentControl = (
                <>
                    {senderName && <span className='dialog-content-accent'>{senderName}: </span>}
                    {content}
                </>
            );
        }

        return <div className='dialog-content'>{contentControl}</div>;
    }
}

export default DialogContentControl;
